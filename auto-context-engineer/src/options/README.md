# Options Component

The options component provides a comprehensive settings interface for the Auto Context Engineer extension, accessible via the extension's settings or options page.

## Features

### Privacy & Security Settings
- **Local Only Mode**: Toggle to keep all data on device
- **Cloud Features**: Opt-in control for cloud-based summarization
- **Audit Logging**: Enable/disable comprehensive audit trails
- **Privacy Guarantee**: Clear explanation of data handling practices

### Summarization Settings
- **Algorithm Selection**: Choose between TextRank, TF-IDF, and frequency-based algorithms
- **Compression Target**: Adjustable slider for summary length (10-80% of original)
- **Quality Threshold**: Minimum quality score for automatic summarization
- **Auto Summarize**: Toggle automatic summarization when approaching token limits

### Storage & Data Management
- **Usage Statistics**: Visual display of storage usage and context counts
- **Data Export**: Export all data in JSON format for backup
- **Data Clearing**: Secure deletion of all stored data
- **Storage Monitoring**: Real-time storage usage tracking

### Interface Settings
- **Theme Selection**: Auto, Light, or Dark theme options
- **Dashboard Layout**: Compact, Detailed, or Custom layout options
- **Notification Preferences**: Control which notifications are shown

### Cloud Integration (Coming Soon)
- **API Key Management**: Secure storage of user-provided API keys
- **Provider Selection**: Choose between OpenAI, Claude, and Gemini
- **Cost Controls**: Set daily, monthly, and per-request spending limits
- **Fallback Behavior**: Configure what happens when cloud services fail

### Advanced Settings
- **Developer Options**: Advanced configuration for power users
- **Performance Tuning**: Memory and processing optimization controls
- **Debug Settings**: Logging and diagnostic options

## Technical Implementation

### Architecture
- **Modular Design**: Each settings section is a separate component
- **State Management**: Centralized preferences state with React hooks
- **Persistence**: Automatic saving to encrypted local storage
- **Validation**: Input validation and error handling

### Data Flow
1. Load preferences from background service worker
2. Display current settings in appropriate UI controls
3. Update local state on user changes
4. Validate changes before saving
5. Persist to encrypted storage via background worker

### Security
- **Encryption**: All preferences encrypted with AES-256
- **Validation**: Input sanitization and validation
- **Audit Trail**: All changes logged for security compliance
- **Privacy First**: No data transmitted without explicit consent

## API Integration

The options page communicates with the background service worker using these message types:

- `GET_PREFERENCES` - Loads current user preferences
- `SAVE_PREFERENCES` - Saves updated preferences
- `GET_STORAGE_STATS` - Retrieves storage usage statistics
- `CLEAR_ALL_DATA` - Securely deletes all stored data
- `EXPORT_DATA` - Exports data for backup
- `VALIDATE_API_KEY` - Validates cloud provider API keys

## User Experience

### Navigation
- **Sidebar Navigation**: Easy switching between settings sections
- **Visual Indicators**: Clear icons and labels for each section
- **Breadcrumbs**: Always know which section you're in
- **Sticky Save**: Save button always visible at bottom

### Form Design
- **Progressive Disclosure**: Advanced options hidden by default
- **Contextual Help**: Tooltips and descriptions for complex settings
- **Immediate Feedback**: Real-time validation and status updates
- **Undo Support**: Changes not saved until explicit save action

### Responsive Design
- **Flexible Layout**: Adapts to different window sizes
- **Mobile Friendly**: Touch-friendly controls and spacing
- **High DPI**: Crisp rendering on high-resolution displays

## Accessibility Features

### Keyboard Navigation
- **Tab Order**: Logical tab sequence through all controls
- **Keyboard Shortcuts**: Common shortcuts for save, cancel, etc.
- **Focus Indicators**: Clear visual focus indicators
- **Skip Links**: Quick navigation to main content areas

### Screen Reader Support
- **ARIA Labels**: Comprehensive labeling for all controls
- **Semantic HTML**: Proper heading hierarchy and landmarks
- **Status Updates**: Screen reader announcements for changes
- **Form Validation**: Accessible error messages and validation

### Visual Accessibility
- **Color Contrast**: WCAG AA compliant color combinations
- **Font Scaling**: Respects user font size preferences
- **Motion Reduction**: Respects prefers-reduced-motion
- **High Contrast**: Compatible with high contrast modes

## Testing

### Unit Tests
- Component rendering and state management
- Form validation and error handling
- API integration and data persistence
- User interaction flows

### Integration Tests
- End-to-end settings workflows
- Cross-browser compatibility
- Performance under load
- Error recovery scenarios

### Accessibility Tests
- Keyboard navigation testing
- Screen reader compatibility
- Color contrast validation
- Focus management verification

Run tests with:
```bash
npm test options
npm test a11y
```

## Configuration Examples

### Basic Privacy Setup
```typescript
const privacySettings = {
  localOnly: true,
  cloudOptIn: false,
  auditLogging: true
};
```

### Summarization Optimization
```typescript
const summarizationSettings = {
  localAlgorithm: LocalAlgorithm.TEXTRANK,
  compressionTarget: 0.3, // 30% of original length
  qualityThreshold: 0.7,  // 70% minimum quality
  autoSummarize: true
};
```

### Cloud Integration
```typescript
const cloudSettings = {
  providers: [
    {
      provider: CloudProvider.OPENAI,
      apiKey: 'user-provided-key',
      enabled: true,
      priority: 1
    }
  ],
  costLimits: {
    dailyLimit: 5.00,
    monthlyLimit: 50.00,
    perRequestLimit: 0.50
  }
};
```

## Performance Metrics

- **Load Time**: Under 500ms for initial render
- **Save Time**: Under 200ms for preference updates
- **Memory Usage**: Under 15MB for full options page
- **Bundle Size**: Under 100KB for options component

## Browser Support

- Chrome 88+ (full support)
- Firefox 78+ (full support)
- Edge 88+ (full support)
- Safari 14+ (limited support, no cloud features)

## Troubleshooting

### Common Issues
1. **Settings not saving**: Check browser permissions
2. **Export not working**: Verify popup blocker settings
3. **Slow performance**: Clear browser cache and restart
4. **Missing features**: Update to latest extension version

### Debug Mode
Enable debug mode in Advanced Settings to get detailed logging and diagnostic information.