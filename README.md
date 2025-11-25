# StepTracker

An iOS-style Progressive Web App for tracking walking steps with precision timing and historical charts.

## Features

- **Real-time Step Tracking**: Uses DeviceMotion API to detect steps while walking
- **Precise Timer**: Tracks walk duration down to the second
- **Steps Per Minute**: Real-time calculation of walking pace
- **Historical Data**: All walks are saved and can be reviewed
- **Visual Charts**: Bar charts showing step history over time
- **Period Filtering**: View data by week, month, or all time
- **iOS-style Design**: Dark mode interface following Apple's Human Interface Guidelines
- **PWA Support**: Installable on iOS and Android devices

## Usage

1. Open the app in a mobile browser (Safari on iOS or Chrome on Android)
2. Tap "Start Walk" to begin tracking
3. Walk with your phone - steps will be counted automatically
4. Tap "Stop Walk" when finished
5. View your summary with total steps, duration, and pace
6. Check the History tab for past walks and charts

## Installation as PWA

### iOS (Safari)
1. Open the app in Safari
2. Tap the Share button
3. Select "Add to Home Screen"
4. Tap "Add"

### Android (Chrome)
1. Open the app in Chrome
2. Tap the menu (three dots)
3. Select "Add to Home screen"
4. Tap "Add"

## Technical Details

- **Step Detection**: Uses the DeviceMotion API with acceleration threshold detection
- **Data Storage**: localStorage for persisting walk history
- **Charts**: Chart.js for rendering bar charts
- **Offline Support**: Service Worker for offline functionality

## Browser Support

- Safari (iOS 13+)
- Chrome (Android 7+)
- Other modern browsers with DeviceMotion API support

## Files

- `index.html` - Main app structure
- `styles.css` - iOS-style CSS styling
- `app.js` - Application logic
- `manifest.json` - PWA manifest
- `sw.js` - Service worker for offline support
- `icons/` - App icons for PWA

## Generating Icons

The `icons/icon.svg` file can be used to generate PNG icons at various sizes:
- 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512

Use an SVG to PNG converter or design tool to export these sizes.

## Development

Simply serve the files using any static HTTP server:

```bash
# Using Python
python -m http.server 8080

# Using Node.js
npx serve

# Using PHP
php -S localhost:8080
```

Then open `http://localhost:8080` in your browser.

## Notes

- Motion permission is required on iOS 13+ (will prompt automatically)
- On desktop browsers without motion sensors, steps are simulated for testing
- All data is stored locally on the device
