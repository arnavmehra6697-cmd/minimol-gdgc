import os
from PIL import Image, ImageDraw

os.makedirs('build', exist_ok=True)

# Generate a high-res 256x256 image with smooth anti-aliased icon
size = 256
img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Outer soft rounded square with blue-sky gradient aesthetic
margin = 12
r = 48
# Background rounded rectangle
draw.rounded_rectangle([margin, margin, size - margin, size - margin], radius=r, fill=(2, 132, 199, 255)) # Sky-600

# Inner subtle glow
draw.rounded_rectangle([margin + 4, margin + 4, size - margin - 4, size - margin - 4], radius=r - 2, outline=(186, 230, 253, 180), width=4)

# Draw central cloud shape in crisp white
# Cloud circles
draw.ellipse([70, 110, 140, 180], fill=(255, 255, 255, 255)) # Left puff
draw.ellipse([110, 80, 190, 160], fill=(255, 255, 255, 255))  # Top puff
draw.ellipse([140, 110, 200, 175], fill=(255, 255, 255, 255)) # Right puff
draw.rectangle([95, 135, 180, 180], fill=(255, 255, 255, 255)) # Base fill

# Small accent node dots representing decentralized mesh
dot_color = (254, 240, 138, 255) # Light amber
draw.ellipse([60, 75, 78, 93], fill=dot_color)
draw.ellipse([195, 75, 213, 93], fill=dot_color)
draw.ellipse([128, 195, 146, 213], fill=dot_color)

# Connecting faint lines
draw.line([69, 84, 110, 115], fill=(255, 255, 255, 120), width=3)
draw.line([204, 84, 165, 115], fill=(255, 255, 255, 120), width=3)
draw.line([137, 204, 137, 180], fill=(255, 255, 255, 120), width=3)

# Save multi-resolution Windows ICO (16, 24, 32, 48, 64, 128, 256)
icon_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
img.save('build/icon.ico', format='ICO', sizes=icon_sizes)
img.save('public/hive-icon.png', format='PNG')
print('Successfully generated build/icon.ico and public/hive-icon.png')
