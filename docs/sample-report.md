MarkupAudit Report

Overall Score: 76/100

Source: Raw Input


Semantic Structure (85)
[Critical] Missing <main> landmark.
Tip: Wrap your primary content in a <main> tag to help screen readers identify the core content.
Accessibility Basics (55)


[Critical] Image missing 'alt' attribute (src="logo.png"). (Line 10)
Code: <img src="logo.png"> <!-- Accessibility: Missing Alt -->...
Tip: Add alt="..." describing the image content (e.g., alt="Company Logo").

[Critical] <html> element missing "lang" attribute (e.g., lang="en").
Tip: Add lang="en" (or your language code) to the <html> tag.

[Critical] Button has no text content or aria-label. (Line 12)
Code: <button></button> <!-- Access: Empty Button -->
Tip: Add text content inside the button or use aria-label="..." to describe its action.
UI & Markup Hygiene (95)

[Warning] Inline style used on <div>. (Line 8)
Code: <div>
Tip: Move CSS to an external stylesheet or <style> block using classes.
Document Completeness (70)

[Critical] Missing or empty <title> tag.
Tip: Add a descriptive <title> in the <head> section.

[Critical] Missing <meta name="viewport"> tag.
Tip: Add <meta name="viewport" content="width=device-width, initial-scale=1.0"> for mobile responsiveness.

[Info] Missing Open Graph meta tags (og:title, og:image).
Tip: Add <meta property="og:title" ...> and og:image to improve social sharing previews.