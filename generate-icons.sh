#!/bin/bash
# Chrome Extension Icon Generator (Shell Script)
# Generates all required icon sizes from favicon.png using ImageMagick

echo "🚀 Chrome Extension Icon Generator (ImageMagick)"
echo "================================================"

# Check if favicon.png exists
if [ ! -f "favicon.png" ]; then
    echo "❌ Error: favicon.png not found!"
    echo "Please make sure favicon.png is in the chrome-extension/ directory"
    exit 1
fi

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "❌ ImageMagick not found!"
    echo ""
    echo "🔧 Install ImageMagick:"
    echo "   macOS: brew install imagemagick"
    echo "   Ubuntu: sudo apt-get install imagemagick"
    echo "   Windows: Download from https://imagemagick.org/script/download.php"
    exit 1
fi

echo "📖 Processing favicon.png..."

# Get original image dimensions
original_size=$(identify -format "%wx%h" favicon.png)
echo "   Original size: ${original_size}px"

# Required sizes for Chrome Web Store
sizes=(16 48 128)

# Generate each size
for size in "${sizes[@]}"; do
    output_file="icon-${size}.png"
    echo "🔄 Generating ${output_file} (${size}x${size}px)..."
    
    # Use ImageMagick to resize with high quality and force square dimensions
    # The ! flag forces exact dimensions, ^ centers the image, and -extent ensures square output
    convert favicon.png -resize "${size}x${size}^" -gravity center -extent "${size}x${size}" -quality 100 "$output_file"
    
    if [ -f "$output_file" ]; then
        file_size=$(stat -f%z "$output_file" 2>/dev/null || stat -c%s "$output_file" 2>/dev/null)
        echo "✅ Created ${output_file} (${file_size} bytes)"
    else
        echo "❌ Failed to create ${output_file}"
        exit 1
    fi
done

echo ""
echo "🎉 Successfully generated all ${#sizes[@]} icons!"
echo ""
echo "Generated files:"
for size in "${sizes[@]}"; do
    filename="icon-${size}.png"
    if [ -f "$filename" ]; then
        file_size=$(stat -f%z "$filename" 2>/dev/null || stat -c%s "$filename" 2>/dev/null)
        echo "   📁 ${filename} (${file_size} bytes)"
    fi
done

echo ""
echo "✨ Your extension is now ready for Chrome Web Store!"
echo ""
echo "🎯 Next steps:"
echo "1. Check the generated icons look good"
echo "2. Package your extension: zip -r BigQuerySmartExecute.zip ."
echo "3. Upload to Chrome Web Store!" 