#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Try to load sharp, but don't fail if it's not available
let sharp;
try {
    sharp = require('sharp');
} catch (e) {
    console.log('⚠ Sharp not installed - images will not be processed locally');
    console.log('  (GitHub Actions will process them automatically on deployment)');
}

// Parse command line arguments
const args = process.argv.slice(2);
const FORCE_REGENERATE = args.includes('--force') || args.includes('-f');
const SKIP_IMAGES = args.includes('--skip-images');
const IMAGES_ONLY = args.includes('--images-only');

// Paths
const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data', 'maps');
const TEMPLATES_DIR = path.join(ROOT_DIR, 'templates');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const IMAGES_DIR = path.join(ROOT_DIR, 'images', 'maps');
const THUMBNAILS_DIR = path.join(PUBLIC_DIR, 'images', 'thumbnails');

// Ensure public directory exists
if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

// Ensure thumbnails directory exists
if (!fs.existsSync(THUMBNAILS_DIR)) {
    fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
}

// Load all map metadata
function loadMapData() {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    return files.map(file => {
        const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
        return data;
    }).sort((a, b) => a.year - b.year); // Sort by year
}

// Load template
function loadTemplate(name) {
    return fs.readFileSync(path.join(TEMPLATES_DIR, name), 'utf8');
}

// Check if image needs regeneration
function needsRegeneration(sourceImage, targetFiles) {
    // Force flag overrides all checks
    if (FORCE_REGENERATE) {
        return true;
    }
    
    // Check if source exists
    if (!fs.existsSync(sourceImage)) {
        return false; // Can't regenerate if source missing
    }
    
    const sourceStats = fs.statSync(sourceImage);
    
    // Check if all target files exist and are newer than source
    for (const targetFile of targetFiles) {
        if (!fs.existsSync(targetFile)) {
            return true; // Missing file, need to generate
        }
        
        const targetStats = fs.statSync(targetFile);
        if (targetStats.mtime < sourceStats.mtime) {
            return true; // Target older than source, need to regenerate
        }
    }
    
    return false; // All files exist and are up to date
}

// Generate thumbnails for all maps
async function generateThumbnails(maps) {
    if (!sharp) {
        console.log('\n⚠ Sharp not installed - thumbnails will not be generated locally');
        console.log('  (GitHub Actions will generate them automatically on deployment)');
        console.log('  To generate thumbnails locally, install sharp: npm install sharp\n');
        return;
    }
    
    console.log('\n📸 Generating 800x800 thumbnails...\n');
    
    // Ensure thumbnails directory exists
    if (!fs.existsSync(THUMBNAILS_DIR)) {
        fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
    }
    
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    for (const map of maps) {
        const sourceImage = path.join(IMAGES_DIR, map.imageFile);
        const thumbnailFilename = map.imageFile.replace(/\.(jpg|jpeg|png)$/i, '-thumb.jpg');
        const thumbnailPath = path.join(THUMBNAILS_DIR, thumbnailFilename);
        
        // Check if source image exists
        if (!fs.existsSync(sourceImage)) {
            console.error(`✗ Source image not found: ${sourceImage}`);
            errorCount++;
            continue;
        }
        
        // Check if regeneration needed
        if (!needsRegeneration(sourceImage, [thumbnailPath])) {
            console.log(`⏭️  Skipped ${thumbnailFilename} (up to date)`);
            skippedCount++;
            continue;
        }
        
        try {
            await sharp(sourceImage)
                .resize(800, 800, {
                    fit: 'cover',
                    position: 'center',
                    kernel: 'lanczos3'  // Sharpest resize algorithm
                })
                .jpeg({ 
                    quality: 92,  // Reduced from 98 for better compression
                    mozjpeg: true
                })
                .toFile(thumbnailPath);
            
            // Verify the thumbnail was created
            if (fs.existsSync(thumbnailPath)) {
                const stats = fs.statSync(thumbnailPath);
                console.log(`✓ Generated ${thumbnailFilename} (${Math.round(stats.size / 1024)}KB)`);
                successCount++;
            } else {
                console.error(`✗ Failed to create thumbnail: ${thumbnailFilename}`);
                errorCount++;
            }
        } catch (error) {
            console.error(`✗ Error generating thumbnail for ${map.imageFile}:`, error.message);
            errorCount++;
        }
    }
    
    console.log(`\n📸 Thumbnail generation complete: ${successCount} generated, ${skippedCount} skipped, ${errorCount} errors`);
}

// Generate multi-resolution images with WebP support
async function generateMultiResolutionImages(maps) {
    if (!sharp) {
        console.log('\n⚠ Sharp not installed - multi-resolution images will not be generated locally');
        console.log('  (GitHub Actions will generate them automatically on deployment)\n');
        return;
    }
    
    if (FORCE_REGENERATE) {
        console.log('\n🔄 Force regeneration enabled - rebuilding ALL images\n');
    }
    
    console.log('\n🖼️  Generating multi-resolution images (WebP + fallback)...\n');
    
    const publicImagesDir = path.join(PUBLIC_DIR, 'images');
    if (!fs.existsSync(publicImagesDir)) {
        fs.mkdirSync(publicImagesDir, { recursive: true });
    }
    
    const sizes = [
        { suffix: '-small', scale: 0.25, description: '25%' },      // was 12.5%
        { suffix: '-medium', scale: 0.50, description: '50%' },     // was 25%
        { suffix: '-large', scale: 0.75, description: '75%' },      // was 50%
        { suffix: '', scale: 1.0, description: '100% (optimized)' }
    ];
    
    let totalSuccess = 0;
    let totalError = 0;
    let totalSkipped = 0;
    
    for (const map of maps) {
        const sourceImage = path.join(IMAGES_DIR, map.imageFile);
        
        // Check if source image exists
        if (!fs.existsSync(sourceImage)) {
            console.error(`✗ Source image not found: ${sourceImage}`);
            totalError++;
            continue;
        }
        
        const isPNG = map.imageFile.toLowerCase().endsWith('.png');
        const ext = isPNG ? '.png' : '.jpg';
        const baseName = map.imageFile.replace(/\.(jpg|jpeg|png)$/i, '');
        
        // Determine all target files for this map
        const allTargetFiles = [];
        for (const size of sizes) {
            allTargetFiles.push(path.join(publicImagesDir, `${baseName}${size.suffix}.webp`));
            allTargetFiles.push(path.join(publicImagesDir, `${baseName}${size.suffix}${ext}`));
        }
        
        // Check if regeneration needed for this map
        if (!needsRegeneration(sourceImage, allTargetFiles)) {
            console.log(`⏭️  Skipped ${map.imageFile} (all variants up to date)`);
            totalSkipped += allTargetFiles.length;
            continue;
        }
        
        console.log(`\n🔨 Processing ${map.imageFile} (${map.imageWidth}×${map.imageHeight})...`);
        
        for (const size of sizes) {
            const outputWidth = Math.round(map.imageWidth * size.scale);
            const outputHeight = Math.round(map.imageHeight * size.scale);
            
            try {
                // Generate WebP version (best compression for all browsers)
                const webpPath = path.join(publicImagesDir, `${baseName}${size.suffix}.webp`);
                await sharp(sourceImage)
                    .resize(outputWidth, outputHeight, {
                        fit: 'inside',
                        withoutEnlargement: true,
                        kernel: 'lanczos3'  // Sharpest resize algorithm
                    })
                    .sharpen()  // Add sharpening for better clarity
                    .webp({ 
                        quality: 92,  // Reduced from 98 for better compression
                        effort: 4  // Balanced speed/compression
                    })
                    .toFile(webpPath);
                
                const webpStats = fs.statSync(webpPath);
                console.log(`  ✓ WebP ${size.description}: ${outputWidth}×${outputHeight} (${Math.round(webpStats.size / 1024)}KB)`);
                
                // Generate fallback in original format
                const fallbackPath = path.join(publicImagesDir, `${baseName}${size.suffix}${ext}`);
                const sharpInstance = sharp(sourceImage)
                    .resize(outputWidth, outputHeight, {
                        fit: 'inside',
                        withoutEnlargement: true,
                        kernel: 'lanczos3'  // Sharpest resize algorithm
                    })
                    .sharpen();  // Add sharpening for better clarity
                
                if (isPNG) {
                    await sharpInstance
                        .png({ 
                            compressionLevel: 9,  // Maximum compression
                            adaptiveFiltering: true,  // Better for photos
                            palette: false  // Keep full color depth for quality
                        })
                        .toFile(fallbackPath);
                } else {
                    await sharpInstance
                        .jpeg({ 
                            quality: 92,  // Reduced from 98 - better compression, still excellent quality
                            progressive: true,
                            mozjpeg: true,
                            chromaSubsampling: '4:4:4'  // Best quality chroma
                        })
                        .toFile(fallbackPath);
                }
                
                const fallbackStats = fs.statSync(fallbackPath);
                console.log(`  ✓ ${isPNG ? 'PNG' : 'JPEG'} ${size.description}: ${outputWidth}×${outputHeight} (${Math.round(fallbackStats.size / 1024)}KB)`);
                
                totalSuccess += 2;
                
            } catch (error) {
                console.error(`  ✗ Error generating ${size.description} for ${map.imageFile}:`, error.message);
                totalError++;
            }
        }
    }
    
    console.log(`\n✅ Multi-resolution generation complete: ${totalSuccess} generated, ${totalSkipped} skipped, ${totalError} errors`);
}

// Generate gallery page
function generateGallery(maps) {
    const template = loadTemplate('gallery.html');
    
    // Generate map cards HTML
    const cardsHTML = maps.map(map => {
        // Format year display with "c." prefix if approximate
        const displayYear = map.yearApproximate 
            ? `c. ${map.year}` 
            : (map.year ? map.year.toString() : map.century || 's/f');
        
        // Use uppercase ID for filename (e.g., S001M023.html)
        const filename = map.id.toUpperCase() + '.html';
        
        // Use thumbnail for gallery
        const thumbnailFile = map.imageFile.replace(/\.(jpg|jpeg|png)$/i, '-thumb.jpg');
        
        return `            <a href="${filename}" class="map-card">
                <div class="map-card-image">
                    <img src="images/thumbnails/${thumbnailFile}" alt="${map.title || 'Mapa'}" loading="lazy">
                </div>
                <div>
                    <h3>${map.title || 'Sin título'}</h3>
                    <p class="map-card-year">${displayYear}</p>
                </div>
            </a>`;
    }).join('\n');
    
    const html = template
        .replace('{{MAPS_COUNT}}', maps.length)
        .replace('{{MAPS_CARDS}}', cardsHTML);
    
    fs.writeFileSync(path.join(PUBLIC_DIR, 'index.html'), html);
    console.log('✓ Generated index.html (gallery)');
}

// Generate individual map detail pages
function generateMapDetails(maps) {
    const template = loadTemplate('map-detail.html');
    
    maps.forEach(map => {
        // Format year display with "c." prefix if approximate
        const displayYear = map.yearApproximate 
            ? `c. ${map.year}` 
            : (map.year ? map.year.toString() : map.century || 'Fecha desconocida');
        
        // Numeric year for JavaScript (always a number or null)
        const numericYear = map.year || 'null';
        
        // Description: uses 'description' field if available, 
        // falls back to 'alternativeTitle', or empty string
        const description = map.description || map.alternativeTitle || '';
        
        const html = template
            .replace(/{{TITLE}}/g, map.title || 'Sin título')
            .replace(/{{DESCRIPTION}}/g, description)
            .replace(/{{YEAR_DISPLAY}}/g, displayYear)
            .replace(/{{YEAR_NUMERIC}}/g, numericYear)
            .replace(/{{AUTHOR}}/g, map.author || 'Autor desconocido')
            .replace(/{{SOURCE}}/g, map.source || 'Fuente desconocida')
            .replace(/{{SOURCE_URL}}/g, map.sourceUrl || '#')
            .replace(/{{CENTER_LAT}}/g, map.centerPoint ? map.centerPoint[0] : 25.6698)
            .replace(/{{CENTER_LNG}}/g, map.centerPoint ? map.centerPoint[1] : -100.3095)
            .replace(/{{IMAGE_WIDTH}}/g, map.imageWidth || 4000)
            .replace(/{{IMAGE_HEIGHT}}/g, map.imageHeight || 3000)
            .replace(/{{METERS_PER_PIXEL}}/g, map.metersPerPixel || 2.5)
            .replace(/{{ROTATION}}/g, map.rotation || 0)
            .replace(/{{DEFAULT_ZOOM}}/g, map.defaultZoom || 15)
            .replace(/{{IMAGE_FILE}}/g, map.imageFile)
            .replace(/{{METADATA_ROWS}}/g, generateMetadataRows(map));
        
        // Use uppercase ID for filename (e.g., S001M023.html)
        const filename = map.id.toUpperCase() + '.html';
        fs.writeFileSync(path.join(PUBLIC_DIR, filename), html);
        console.log(`✓ Generated ${filename}`);
    });
}

// Generate metadata table rows
function generateMetadataRows(map) {
    const rows = [];
    
    // Always show these fields if available
    if (map.title) rows.push(['Título', map.title]);
    if (map.author) rows.push(['Autor(es)', map.author]);
    
    // Year handling
    if (map.year || map.century) {
        const yearText = map.yearApproximate 
            ? `c. ${map.year}` 
            : (map.year ? map.year.toString() : map.century);
        rows.push(['Año / Siglo', yearText]);
    }
    
    // Source
    if (map.source && map.sourceUrl) {
        rows.push(['Fuente', `<a href="${map.sourceUrl}" target="_blank">${map.source}</a>`]);
    } else if (map.source) {
        rows.push(['Fuente', map.source]);
    }
    
    // Scale
    if (map.scale) {
        rows.push(['Escala', map.scale]);
    }
    
    // Language
    if (map.language) {
        rows.push(['Idioma', map.language]);
    }
    
    // Dimensions
    if (map.dimensions) {
        rows.push(['Dimensiones', map.dimensions]);
    }
    
    // Center point
    if (map.centerPoint && map.centerPoint.length === 2) {
        rows.push(['Punto Central', `[${map.centerPoint[0].toFixed(6)}, ${map.centerPoint[1].toFixed(6)}]`]);
    }
    
    // Image dimensions
    if (map.imageWidth && map.imageHeight) {
        rows.push(['Tamaño de Imagen', `${map.imageWidth} × ${map.imageHeight} píxeles`]);
    }
    
    // Scale (meters per pixel)
    if (map.metersPerPixel) {
        rows.push(['Escala Digital', `${map.metersPerPixel} metros/píxel`]);
    }
    
    // Rotation
    if (map.rotation !== undefined) {
        rows.push(['Rotación', `${map.rotation}°${map.rotation === 0 ? ' (norte arriba)' : ''}`]);
    }
    
    return rows.map(([label, value]) => `                            <tr>
                                <td>${label}</td>
                                <td>${value}</td>
                            </tr>`).join('\n');
}

// Copy images to public directory
function copyImages() {
    const publicImagesDir = path.join(PUBLIC_DIR, 'images');
    const sourceImagesDir = path.join(ROOT_DIR, 'images', 'maps');
    
    if (!fs.existsSync(publicImagesDir)) {
        fs.mkdirSync(publicImagesDir, { recursive: true });
    }
    
    // Copy all images from images/maps to public/images
    if (fs.existsSync(sourceImagesDir)) {
        const images = fs.readdirSync(sourceImagesDir);
        
        images.forEach(img => {
            const src = path.join(sourceImagesDir, img);
            const dest = path.join(publicImagesDir, img);
            
            if (fs.existsSync(src)) {
                fs.copyFileSync(src, dest);
                console.log(`✓ Copied ${img}`);
            }
        });
    } else {
        console.log(`⚠ Images directory not found: ${sourceImagesDir}`);
    }
}

// Main build function
async function build() {
    console.log('🏗️  Building Monterrey Cartográfico with multi-resolution support...\n');
    
    if (FORCE_REGENERATE) {
        console.log('🔄 Force regeneration flag detected - will rebuild ALL images\n');
    }
    
    if (SKIP_IMAGES) {
        console.log('⏭️  Skip images flag detected - will not process images\n');
    }
    
    if (IMAGES_ONLY) {
        console.log('🖼️  Images only flag detected - will only generate images\n');
    }
    
    const maps = loadMapData();
    console.log(`📚 Loaded ${maps.length} maps\n`);
    
    // Generate images (thumbnails and multi-resolution)
    if (!SKIP_IMAGES) {
        await generateThumbnails(maps);
        await generateMultiResolutionImages(maps);
    }
    
    // Generate HTML pages
    if (!IMAGES_ONLY) {
        console.log('\n📄 Generating HTML pages...\n');
        generateGallery(maps);
        generateMapDetails(maps);
        
        console.log('\n📁 Copying original images...\n');
        copyImages();
    }
    
    console.log('\n✅ Build complete!');
    console.log(`\n📂 Generated files in: ${PUBLIC_DIR}`);
    
    if (!sharp && !SKIP_IMAGES) {
        console.log('\n💡 Note: Sharp not installed locally.');
        console.log('   Images will be generated automatically when deployed to GitHub Pages.');
        console.log('   To generate images locally: npm install sharp');
    }
}

// Run build
build().catch(error => {
    console.error('❌ Build failed:', error);
    process.exit(1);
});
