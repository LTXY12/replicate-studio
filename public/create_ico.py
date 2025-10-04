from PIL import Image

# Load the 1024x1024 icon
img = Image.open('icon_1024.png')

# Create multiple sizes for .ico (Windows multi-resolution icon)
sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
images = []

for size in sizes:
    resized = img.resize(size, Image.Resampling.LANCZOS)
    images.append(resized)

# Save as .ico
images[0].save('icon.ico', format='ICO', sizes=[(s[0], s[1]) for s in sizes], append_images=images[1:])
print("Created icon.ico with sizes:", sizes)
