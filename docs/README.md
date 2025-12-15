# HiveSnaps Static Pages

This directory contains the static HTML pages required for app store compliance and user information.

## GitHub Pages Setup

The website is served from the `/docs` folder and accessible at:
https://menobass.github.io/hivesnaps

## Pages

### 1. `index.html`
- Main landing page for HiveSnaps
- Features overview and Hive blockchain information
- Links to all other policy pages
- Responsive design with mobile-first approach

### 2. `privacy-policy.html`
- Detailed privacy policy explaining data handling
- Emphasizes decentralized nature and minimal data collection
- GDPR and privacy regulation compliance
- Links to child safety standards

### 3. `child-safety-standards.html` 🆕
- **Google Play Store requirement**: Child Sexual Abuse and Exploitation (CSAE) safety standards
- Comprehensive child protection policies and procedures
- Reporting mechanisms and emergency contact information
- Partnership with organizations like NCMEC, IWF, and INHOPE
- Zero tolerance policy for child exploitation content

## Google Play Store Compliance

The `child-safety-standards.html` page was created specifically to meet Google Play's requirement for:
> Safety standards URL: Provide a link to your app's externally published standards against child sexual abuse and exploitation (CSAE)

### Key Features:
- ✅ Zero tolerance policy for CSAE content
- ✅ Detailed reporting mechanisms (in-app and external)
- ✅ Partnership with law enforcement and safety organizations
- ✅ Age verification and access controls
- ✅ Technology-based detection and prevention measures
- ✅ Emergency contact information prominently displayed
- ✅ Clear escalation procedures for reports

## Integration with App

### Report Service Updates
The `services/reportService.ts` has been updated to include:
- New `child_safety` report type
- Priority handling for child safety reports
- Proper routing to safety team

### Configuration
New `config/safety.ts` file provides:
- Child safety standards URL
- Emergency contact information
- Safety configuration constants

### In-App References
- Terms of Service updated to reference child safety standards
- Privacy Policy links to child safety standards
- Report flow prioritizes child safety concerns

## URLs

When deployed, these pages should be accessible at:
- Main page: `https://menobass.github.io/hivesnaps/`
- Privacy Policy: `https://menobass.github.io/hivesnaps/privacy-policy.html`
- Child Safety Standards: `https://menobass.github.io/hivesnaps/child-safety-standards.html`

## Local Development

To test locally, you can serve the files using any simple HTTP server:

```bash
# Using Python
cd docs
python -m http.server 8000

# Using Node.js
npx serve docs
```

## Maintenance

Remember to:
1. Keep contact information current
2. Update "Last updated" dates when making changes
3. Ensure all links remain functional
4. Review content annually for compliance updates

## Contact Information

For questions about these pages or policies:
- Contact: snapieapp@proton.me
- GitHub: https://github.com/menobass/hivesnaps
