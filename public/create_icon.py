from PIL import Image, ImageDraw, ImageFont
import math

# Create 1024x1024 image
size = 1024
img = Image.new('RGB', (size, size), color='#000000')
draw = ImageDraw.Draw(img)

# Create gradient background (dark blue to purple)
for y in range(size):
    # Calculate color for this row
    ratio = y / size
    r = int(10 + (80 - 10) * ratio)
    g = int(10 + (40 - 10) * ratio)
    b = int(50 + (140 - 50) * ratio)
    draw.rectangle([(0, y), (size, y+1)], fill=(r, g, b))

# Draw a circular play/triangle icon in center
center = size // 2
circle_radius = size // 3

# Draw outer glow circles
for i in range(5):
    alpha = 40 - i * 8
    r = circle_radius + i * 20
    draw.ellipse(
        [(center - r, center - r), (center + r, center + r)],
        outline=(100, 150, 255, alpha),
        width=3
    )

# Draw main circle
draw.ellipse(
    [(center - circle_radius, center - circle_radius),
     (center + circle_radius, center + circle_radius)],
    fill=(30, 30, 60),
    outline=(120, 180, 255),
    width=8
)

# Draw play triangle (pointing right)
triangle_size = circle_radius // 2
triangle = [
    (center - triangle_size//2, center - triangle_size),
    (center - triangle_size//2, center + triangle_size),
    (center + triangle_size, center)
]
draw.polygon(triangle, fill=(150, 200, 255))

# Save as PNG
img.save('icon_1024.png', 'PNG')
print("Created icon_1024.png")
