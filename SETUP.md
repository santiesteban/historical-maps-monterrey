# Monterrey Viejo - Quick Setup Guide

## Initial Setup

1. **Extract the archive:**
   ```bash
   tar -xzf monterrey-viejo.tar.gz
   cd monterrey-viejo
   ```

2. **Initialize git repository:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

3. **Create GitHub repository:**
   - Go to https://github.com/new
   - Create a new repository named `monterrey-viejo`
   - Don't initialize with README (you already have one)

4. **Push to GitHub:**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/monterrey-viejo.git
   git branch -M main
   git push -u origin main
   ```

5. **Enable GitHub Pages:**
   - Go to repository Settings → Pages
   - Under "Build and deployment"
   - Set Source to "GitHub Actions"
   - The site will automatically deploy

6. **View your site:**
   - After deployment completes, visit:
   - `https://YOUR_USERNAME.github.io/monterrey-viejo/`

## Adding Maps

### Step 1: Add the image

Place your map image in `images/maps/`:
```bash
cp ~/Downloads/my-map.jpg images/maps/map999.jpg
```

### Step 2: Create metadata JSON

Create `data/maps/map999.json`:
```json
{
  "id": "map999",
  "slug": "descriptive-slug",
  "title": "Map Title Here",
  "author": "Author Name",
  "year": 1925,
  "source": "Source Institution",
  "sourceUrl": "https://source.url",
  "centerPoint": [25.6698, -100.3095],
  "imageWidth": 4000,
  "imageHeight": 3000,
  "metersPerPixel": 2.5,
  "rotation": 0,
  "defaultZoom": 14,
  "imageFile": "map999.jpg"
}
```

### Step 3: Build and test locally

```bash
npm run dev
```

Open http://localhost:8000 in your browser.

### Step 4: Deploy

```bash
git add .
git commit -m "Add new map: [map title]"
git push
```

GitHub Actions will automatically build and deploy.

## Updating Templates

The templates are in `templates/`:
- `gallery.html` - Main gallery page
- `map-detail.html` - Individual map pages

After editing templates, rebuild:
```bash
npm run build
```

## Troubleshooting

### Build fails locally
- Make sure Node.js 18+ is installed: `node --version`
- Check JSON files are valid: `cat data/maps/*.json | jq .`

### Images don't appear
- Check image paths in JSON match filenames in `images/maps/`
- Verify images copied to `public/images/` after build

### GitHub Actions fails
- Check workflow run in Actions tab
- Verify `package.json` is committed
- Ensure GitHub Pages is set to "GitHub Actions" source

## File Organization

```
monterrey-viejo/
├── .github/workflows/deploy.yml  # Auto-deployment config
├── data/maps/*.json              # Map metadata (you edit)
├── images/maps/*.jpg             # Map images (you add)
├── templates/*.html              # HTML templates (you edit)
├── build/generate.js             # Build script (don't edit)
├── public/                       # Generated site (auto-generated)
└── package.json                  # Build config
```

## Tips

1. **Image format:** JPG or PNG, recommend < 2MB per image
2. **Slugs:** Use lowercase, hyphens, no special characters
3. **Center point:** Use [lat, lng] format, get from map tool
4. **Zoom level:** 13-15 works well for city maps
5. **Rotation:** 0 = north up, positive = clockwise
6. **Scale:** Measure a known distance on map, divide by pixel width

## Need Help?

- Check build logs: `npm run build`
- Validate JSON: https://jsonlint.com/
- Find coordinates: https://www.latlong.net/
