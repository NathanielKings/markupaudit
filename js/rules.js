/**
 * MarkupAudit v2 Rules Engine
 * Handles parsing, analysis, and scoring of HTML.
 */

export class AuditEngine {
    constructor() {
        this.parser = new DOMParser();
    }

    /**
     * Run the audit on raw HTML string
     * @param {string} rawHtml 
     * @param {string} sourceName 
     * @returns {object} Structured and Scored Report
     */
    run(rawHtml, sourceName = 'Raw Input') {
        if (!rawHtml || rawHtml.trim().length === 0) {
            throw new Error("Input is empty.");
        }

        const doc = this.parser.parseFromString(rawHtml, "text/html");

        // Execute Checks
        const catSemantics = this.checkSemantics(doc, rawHtml);
        const catAccess = this.checkAccessibility(doc, rawHtml);
        const catHygiene = this.checkHygiene(doc, rawHtml);
        const catCompleteness = this.checkCompleteness(doc, rawHtml);

        const categories = [catSemantics, catAccess, catHygiene, catCompleteness];

        // UI/UX Note: We might want a weighted average, but simple average is fine for v2.
        const totalScore = categories.reduce((sum, cat) => sum + cat.score, 0);
        const overallScore = Math.round(totalScore / categories.length);

        return {
            metadata: {
                length: rawHtml.length,
                date: new Date().toISOString().split('T')[0],
                source: sourceName
            },
            overallScore,
            categories
        };
    }

    /**
     * Helper to create an issue object
     */
    createIssue(severity, description, suggestion, lineNumber = null, context = null) {
        return { severity, description, suggestion, lineNumber, context };
    }

    /**
     * Helper to find approximate line number and snippet
     */
    getLineNumber(rawHtml, element) {
        try {
            // Heuristic: Search for a unique-ish string from outerHTML
            // We strip newlines to avoid formatting mismatch
            let searchStr = "";
            let tagName = element.tagName.toLowerCase();

            if (element.id) {
                searchStr = `id="${element.id}"`;
            } else if (element.className) {
                searchStr = `class="${element.className}"`;
            } else if (element.getAttribute('src')) {
                searchStr = `src="${element.getAttribute('src')}"`;
            } else {
                // Fallback to tag name start
                searchStr = `<${tagName}`;
            }

            const index = rawHtml.indexOf(searchStr);
            if (index === -1) return { line: null, snippet: null };

            const linesBefore = rawHtml.substring(0, index).split('\n');
            const line = linesBefore.length;

            // Get a snippet (the line itself)
            const snippetLine = rawHtml.split('\n')[line - 1] || "";
            const snippet = snippetLine.trim().substring(0, 60) + (snippetLine.length > 60 ? "..." : "");

            return { line, snippet };
        } catch (e) {
            console.error(e);
            return { line: null, snippet: null };
        }
    }

    /**
     * Helper to calculate score based on issues
     * Start: 100
     * Critical: -15
     * Warning: -5
     * Min: 0
     */
    calculateScore(issues) {
        let score = 100;
        issues.forEach(issue => {
            if (issue.severity === 'Critical') score -= 15;
            if (issue.severity === 'Warning') score -= 5;
            // Info does not deduct points
        });
        return Math.max(0, score);
    }

    /**
     * 1. Semantic Structure Checks
     */
    checkSemantics(doc, rawHtml) {
        const issues = [];

        // v1: Check for <main>
        const main = doc.querySelector('main');
        if (!main) {
            issues.push(this.createIssue('Critical', 'Missing <main> landmark.', 'Wrap your primary content in a <main> tag to help screen readers identify the core content.'));
        } else if (doc.querySelectorAll('main').length > 1) {
            const extra = doc.querySelectorAll('main')[1];
            const loc = this.getLineNumber(rawHtml, extra);
            issues.push(this.createIssue('Warning', 'Multiple <main> landmarks found.', 'Ensure only one <main> element exists per page, or use the "hidden" attribute on others.', loc.line, loc.snippet));
        }

        // v1: Check for <h1>
        const h1s = doc.querySelectorAll('h1');
        if (h1s.length === 0) {
            issues.push(this.createIssue('Critical', 'Missing <h1> heading.', 'Add a single <h1> heading to describe the page topic.'));
        } else if (h1s.length > 1) {
            const loc = this.getLineNumber(rawHtml, h1s[1]);
            issues.push(this.createIssue('Warning', 'Multiple <h1> tags found.', 'Use only one <h1> per page for the main title, and use <h2>-<h6> for subsections.', loc.line, loc.snippet));
        }

        // v1: Check landmarks
        const landmarks = ['header', 'nav', 'footer', 'section', 'article', 'aside'];
        const foundLandmarks = landmarks.filter(l => doc.querySelector(l));
        if (foundLandmarks.length === 0) {
            issues.push(this.createIssue('Warning', 'No semantic landmarks (<header>, <nav>, etc.) found.', 'Replace generic <div> wrappers with semantic tags like <header>, <nav>, or <footer> where appropriate.'));
        }

        // v2: Check Duplicate IDs
        const allElements = doc.querySelectorAll('*[id]');
        const ids = new Set();
        allElements.forEach(el => {
            if (ids.has(el.id)) {
                const loc = this.getLineNumber(rawHtml, el);
                issues.push(this.createIssue('Critical', `Duplicate ID found: "${el.id}".`, `Rename the ID "${el.id}" to be unique on the page. IDs must not be repeated.`, loc.line, loc.snippet));
            }
            ids.add(el.id);
        });

        // v2: Check ARIA Landmark Roles
        const divMain = doc.querySelector('div[role="main"]');
        if (divMain) {
            const loc = this.getLineNumber(rawHtml, divMain);
            issues.push(this.createIssue('Info', 'Found <div role="main">.', 'Replace <div role="main"> with the native <main> element for better standard compliance.', loc.line, loc.snippet));
        }

        return {
            name: "Semantic Structure",
            issues,
            score: this.calculateScore(issues)
        };
    }

    /**
     * 2. Accessibility Basics
     */
    checkAccessibility(doc, rawHtml) {
        const issues = [];

        // v1: Images missing alt
        const images = doc.querySelectorAll('img');
        let imagesWithoutAlt = 0;
        images.forEach(img => {
            if (!img.hasAttribute('alt')) {
                imagesWithoutAlt++;
                const src = img.getAttribute('src') || 'unknown';
                const loc = this.getLineNumber(rawHtml, img);
                issues.push(this.createIssue('Critical', `Image missing 'alt' attribute (src="${src}").`, `Add alt="..." describing the image content (e.g., alt="Company Logo").`, loc.line, loc.snippet));
            }
        });

        // v1: Inputs missing labels
        const inputs = doc.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])');
        inputs.forEach(input => {
            let hasLabel = false;
            if (input.getAttribute('aria-label') || input.getAttribute('aria-labelledby')) hasLabel = true;
            if (!hasLabel && input.id && doc.querySelector(`label[for="${input.id}"]`)) hasLabel = true;
            if (!hasLabel && input.closest('label')) hasLabel = true;

            if (!hasLabel) {
                const loc = this.getLineNumber(rawHtml, input);
                issues.push(this.createIssue('Critical', `Input missing associated <label> or aria-label.`, `Link a <label for="id"> to this input, or add an aria-label attribute.`, loc.line, loc.snippet));
            }
        });

        // v1: HTML Lang
        const html = doc.querySelector('html');
        if (!html || !html.hasAttribute('lang') || !html.getAttribute('lang').trim()) {
            issues.push(this.createIssue('Critical', '<html> element missing "lang" attribute (e.g., lang="en").', 'Add lang="en" (or your language code) to the <html> tag.'));
        }

        // v1: Empty Buttons
        const buttons = doc.querySelectorAll('button');
        buttons.forEach(btn => {
            const text = btn.innerText.trim();
            const aria = btn.getAttribute('aria-label') || btn.getAttribute('aria-labelledby');
            if (!text && !aria) {
                const loc = this.getLineNumber(rawHtml, btn);
                issues.push(this.createIssue('Critical', `Button has no text content or aria-label.`, `Add text content inside the button or use aria-label="..." to describe its action.`, loc.line, loc.snippet));
            }
        });

        return {
            name: "Accessibility Basics",
            issues,
            score: this.calculateScore(issues)
        };
    }

    /**
     * 3. UI & Markup Hygiene
     */
    checkHygiene(doc, rawHtml) {
        const issues = [];

        // v1: Inline styles
        const elementsWithStyle = doc.querySelectorAll('[style]');
        if (elementsWithStyle.length > 0) {
            // Just show first 3 as examples to avoid spam
            for (let i = 0; i < Math.min(elementsWithStyle.length, 3); i++) {
                const el = elementsWithStyle[i];
                const loc = this.getLineNumber(rawHtml, el);
                issues.push(this.createIssue('Warning', `Inline style used on <${el.tagName.toLowerCase()}>.`, 'Move CSS to an external stylesheet or <style> block using classes.', loc.line, loc.snippet));
            }
            if (elementsWithStyle.length > 3) {
                issues.push(this.createIssue('Warning', `...and ${elementsWithStyle.length - 3} more elements with inline styles.`, 'Refactor styles into CSS classes to improve maintainability.'));
            }
        }

        // v1: Deep nesting (Limit raised to 8 for v2)
        let maxDepth = 0;
        const checkDepth = (node, depth) => {
            if (depth > maxDepth) maxDepth = depth;
            for (let i = 0; i < node.children.length; i++) {
                checkDepth(node.children[i], depth + 1);
            }
        };
        if (doc.body) checkDepth(doc.body, 0);

        if (maxDepth > 8) {
            issues.push(this.createIssue('Warning', `Excessive DOM nesting detected (Depth: ${maxDepth}).`, 'Flatten your HTML structure. Remove unnecessary wrapper divs.'));
        }

        // v2: Div Soup Check
        const divs = doc.querySelectorAll('div');
        let divSoupCount = 0;
        divs.forEach(div => {
            if (div.children.length === 1 && div.children[0].tagName === 'DIV') {
                divSoupCount++;
                if (divSoupCount <= 3) {
                    const loc = this.getLineNumber(rawHtml, div);
                    issues.push(this.createIssue('Info', 'Potential "Div Soup" (nested container).', 'Remove this wrapper if it serves no styling or layout purpose.', loc.line, loc.snippet));
                }
            }
        });

        return {
            name: "UI & Markup Hygiene",
            issues,
            score: this.calculateScore(issues)
        };
    }

    /**
     * 4. Document Completeness
     */
    checkCompleteness(doc, rawHtml) {
        const issues = [];

        // v1: Title
        if (!doc.querySelector('title') || !doc.querySelector('title').innerText.trim()) {
            issues.push(this.createIssue('Critical', 'Missing or empty <title> tag.', 'Add a descriptive <title> in the <head> section.'));
        }

        // v1: Viewport
        const viewport = doc.querySelector('meta[name="viewport"]');
        if (!viewport) {
            issues.push(this.createIssue('Critical', 'Missing <meta name="viewport"> tag.', 'Add <meta name="viewport" content="width=device-width, initial-scale=1.0"> for mobile responsiveness.'));
        }

        // v2: Social / OpenGraph Tags
        const ogTitle = doc.querySelector('meta[property="og:title"]');
        const ogImage = doc.querySelector('meta[property="og:image"]');
        if (!ogTitle || !ogImage) {
            issues.push(this.createIssue('Info', 'Missing Open Graph meta tags (og:title, og:image).', 'Add <meta property="og:title" ...> and og:image to improve social sharing previews.'));
        }

        // v1: Deprecated tags
        const deprecated = ['font', 'center', 'strike', 'marquee', 'blink'];
        deprecated.forEach(tag => {
            const found = doc.querySelectorAll(tag);
            if (found.length > 0) {
                const loc = this.getLineNumber(rawHtml, found[0]);
                issues.push(this.createIssue('Warning', `Deprecated HTML tag <${tag}> found.`, `Remove <${tag}> and use modern CSS property instead.`, loc.line, loc.snippet));
            }
        });

        return {
            name: "Document Completeness",
            issues,
            score: this.calculateScore(issues)
        };
    }
}
