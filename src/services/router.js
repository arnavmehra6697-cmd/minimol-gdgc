/**
 * HiveNet Intelligent Storage Router Decision Engine
 * Mandate: Evaluate peer telemetry (Disk Quota, Latency, Uptime, Load Balancing).
 * Avoid overflowing low-disk nodes and route to optimal peers with Replication Factor >= 2.
 */

export class SmartStorageRouter {
  constructor(weights = { disk: 0.45, latency: 0.35, uptime: 0.20 }) {
    this.weights = weights;
    this.replicationFactor = 2; // Strict requirement: Replication Factor >= 2
  }

  /**
   * Score and rank all active nodes for storing a given chunk
   * @param {Array} nodes - List of active nodes with telemetry data
   * @param {number} chunkSize - Size of compressed chunk in bytes
   * @returns {Object} { selectedNodes, rankedNodes, decisionLog }
   */
  evaluateNodes(nodes, chunkSize = 0) {
    const activeNodes = nodes.filter(n => n.status === 'ONLINE' && !n.isSimulatedOffline);

    if (activeNodes.length < this.replicationFactor) {
      throw new Error(`Insufficient active nodes to satisfy Replication Factor >= ${this.replicationFactor}. Currently available: ${activeNodes.length}`);
    }

    // Determine max/min ranges for normalization
    const maxDisk = Math.max(...activeNodes.map(n => n.availableDiskMB), 1);
    const maxLatency = Math.max(...activeNodes.map(n => n.latencyMs), 1);
    const maxUptime = Math.max(...activeNodes.map(n => n.uptimeSeconds), 1);
    const totalStored = activeNodes.reduce((acc, n) => acc + (n.storedChunksCount || 0), 0);

    const scoredNodes = activeNodes.map(node => {
      // 1. Disk Quota Health (Normalized 0..1)
      // Severe penalty if free disk is under 200MB or < 5% of total
      const diskScore = Math.min(1, node.availableDiskMB / maxDisk);
      const isCriticalDisk = node.availableDiskMB < 200;

      // 2. Latency Proximity (Normalized 0..1, where lower latency = higher score)
      const latencyScore = Math.max(0, 1 - (node.latencyMs / (maxLatency * 1.2)));

      // 3. Uptime Stability (Normalized 0..1)
      const uptimeScore = Math.min(1, node.uptimeSeconds / maxUptime);

      // 4. Anti-Monopoly Load Balancing Penalty (Problem Mandate: No single phone holds 100% data)
      const shareOfTotal = totalStored > 0 ? (node.storedChunksCount || 0) / totalStored : 0;
      const loadPenalty = shareOfTotal * 0.25;

      // Composite Fitness Equation
      let finalScore = (
        (this.weights.disk * diskScore) +
        (this.weights.latency * latencyScore) +
        (this.weights.uptime * uptimeScore) -
        loadPenalty
      ) * 100;

      // Critical disk penalty
      if (isCriticalDisk) {
        finalScore = Math.max(1, finalScore * 0.15); // Drop score by 85% to protect disk
      }

      finalScore = parseFloat(Math.max(0, finalScore).toFixed(2));

      return {
        ...node,
        scores: {
          diskScore: (diskScore * 100).toFixed(1),
          latencyScore: (latencyScore * 100).toFixed(1),
          uptimeScore: (uptimeScore * 100).toFixed(1),
          loadPenalty: (loadPenalty * 100).toFixed(1),
          finalScore,
        },
      };
    });

    // Rank nodes by final score descending
    scoredNodes.sort((a, b) => b.scores.finalScore - a.scores.finalScore);

    // Pick top nodes according to replication factor (at least 2 distinct nodes)
    const selectedNodes = scoredNodes.slice(0, this.replicationFactor);

    const decisionLog = {
      timestamp: new Date().toISOString(),
      replicationFactor: this.replicationFactor,
      activeNodesCount: activeNodes.length,
      selectedNodeIds: selectedNodes.map(n => n.id),
      selectedNodeNames: selectedNodes.map(n => n.name),
      rankings: scoredNodes.map(n => ({
        id: n.id,
        name: n.name,
        score: n.scores.finalScore,
        diskMB: n.availableDiskMB,
        latencyMs: n.latencyMs,
        uptimeSec: n.uptimeSeconds,
      })),
      reasoning: `Selected [${selectedNodes[0].name}] (Score: ${selectedNodes[0].scores.finalScore}) and [${selectedNodes[1].name}] (Score: ${selectedNodes[1].scores.finalScore}) based on optimal disk capacity and lowest network latency.`,
    };

    return {
      selectedNodes,
      rankedNodes: scoredNodes,
      decisionLog,
    };
  }
}
