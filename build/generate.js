#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Try to load sharp, but don't fail if it's not available
let sharp;
try {
    sharp = require('sharp');
} catch (e) {
    console.log('⚠ Sharp not installed - thumbnails will not be generated locally');
    console.log('  (GitHub Actions will generate them automatically on deployment)');
}

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

// Generate thumbnails for all maps
async function generateThumbnails(maps) {
    if (!sharp) {
        console.log('\n⚠ Skipping thumbnail generation (sharp not installed)');
        console.log('  Thumbnails will be generated automatically on GitHub deployment\n');
        return;
    }
    
    console.log('\nGenerating thumbnails...\n');
    
    for (const map of maps) {
        const sourceImage = path.join(IMAGES_DIR, map.imageFile);
        const thumbnailFilename = map.imageFile.replace('.jpg', '-thumb.jpg');
        const thumbnailPath = path.join(THUMBNAILS_DIR, thumbnailFilename);
        
        try {
            await sharp(sourceImage)
                .resize(400, 400, {
                    fit: 'cover',
                    position: 'center'
                })
                .jpeg({ quality: 85 })
                .toFile(thumbnailPath);
            
            console.log(`✓ Generated thumbnail for ${map.imageFile}`);
        } catch (error) {
            console.error(`✗ Failed to generate thumbnail for ${map.imageFile}:`, error.message);
        }
    }
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
        const thumbnailFile = map.imageFile.replace('.jpg', '-thumb.jpg');
        
        return `
            <a href="${filename}" class="map-card">
                <div class="map-card-image-container">
                    <img src="images/thumbnails/${thumbnailFile}" alt="${map.title || 'Mapa'}">
                </div>
                <div class="map-card-body">
                    <div class="map-card-title">${map.title || 'Sin título'}</div>
                    <div class="map-card-year">${displayYear}</div>
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
        
        const html = template
            .replace(/{{TITLE}}/g, map.title || 'Sin título')
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
            .replace(/{{IMAGE_FILE}}/g, `images/${map.imageFile}`)
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
    
    // Center point
    if (map.centerPoint && map.centerPoint.length === 2) {
        rows.push(['Punto Central', `[${map.centerPoint[0]}, ${map.centerPoint[1]}]`]);
    }
    
    // Image dimensions
    if (map.imageWidth && map.imageHeight) {
        rows.push(['Tamaño de Imagen', `${map.imageWidth} × ${map.imageHeight} pixeles`]);
    }
    
    // Scale
    if (map.metersPerPixel) {
        rows.push(['Escala (metros por pixel)', map.metersPerPixel]);
    }
    
    // Rotation
    if (map.rotation !== undefined) {
        rows.push(['Rotación', `${map.rotation}° ${map.rotation === 0 ? '(norte arriba)' : ''}`]);
    }
    
    return rows.map(([label, value]) => `
                        <tr>
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
    console.log('Building Monterrey Viejo site...\n');
    
    const maps = loadMapData();
    console.log(`Loaded ${maps.length} maps\n`);
    
    // Generate thumbnails first
    await generateThumbnails(maps);
    
    console.log('\nGenerating pages...\n');
    generateGallery(maps);
    generateMapDetails(maps);
    copyImages();
    
    console.log('\n✓ Build complete!');
    console.log(`\nGenerated files in: ${PUBLIC_DIR}`);
}

// Run build
build().catch(error => {
    console.error('Build failed:', error);
    process.exit(1);
});
