
import { AuditEngine } from './rules.js';

const engine = new AuditEngine();
const { jsPDF } = window.jspdf;

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements - Inputs
    const elements = {
        inputSection: document.getElementById('input-section'),
        resultsSection: document.getElementById('results-section'),

        // Tabs
        tabs: document.querySelectorAll('.tab-btn'),
        tabContents: document.querySelectorAll('.tab-content'),

        // Input Fields
        htmlInput: document.getElementById('html-input'),
        urlInput: document.getElementById('url-input'),
        fileInput: document.getElementById('file-input'),
        fileNameDisplay: document.getElementById('file-name'),

        // Actions
        navLogo: document.getElementById('nav-logo'),
        runAuditBtn: document.getElementById('run-audit-btn'),
        clearBtn: document.getElementById('clear-btn'),
        loadSampleBtn: document.getElementById('load-sample-btn'),
        newAuditBtn: document.getElementById('new-audit-btn'),
        exportPdfBtn: document.getElementById('export-pdf-btn'),
        themeToggleBtn: document.getElementById('theme-toggle'),

        // View Containers
        landingView: document.getElementById('landing-view'),
        appView: document.getElementById('app-view'),

        // Landing Buttons
        landingStartBtn: document.getElementById('landing-start-btn'),
        heroCtaBtn: document.getElementById('hero-cta-btn'),

        // Feedback
        errorMessage: document.getElementById('error-message'),
        loadingOverlay: document.getElementById('loading-overlay'),

        // Report
        reportContainer: document.getElementById('report-container'),
        overallScoreVal: document.getElementById('overall-score-value'),
        categoryScoresContainer: document.getElementById('category-scores-container'),
        metaDate: document.getElementById('meta-date'),
        metaLength: document.getElementById('meta-length'),
        metaSource: document.getElementById('meta-source')
    };

    let currentReport = null;
    let activeTab = 'raw'; // raw, url, file

    // --- Theme Handling ---
    const savedTheme = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && systemDark)) {
        document.body.classList.add('dark-mode');
        updateThemeIcon(true);
    }

    elements.themeToggleBtn.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        updateThemeIcon(isDark);
    });

    function updateThemeIcon(isDark) {
        // Simple SVG swap or path change logic
        const btn = elements.themeToggleBtn;
        if (isDark) {
            // Show Sun Icon
            btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
        } else {
            // Show Moon Icon
            btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
        }
    }

    // --- Tab Handling ---
    elements.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Update Tab UI
            elements.tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Show Content
            activeTab = tab.dataset.tab;
            elements.tabContents.forEach(content => {
                if (content.id === `tab-${activeTab}`) {
                    content.classList.remove('hidden');
                } else {
                    content.classList.add('hidden');
                }
            });
            hideError();
        });
    });

    // --- File Input Handling ---
    elements.fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            elements.fileNameDisplay.textContent = file.name;
        } else {
            elements.fileNameDisplay.textContent = '';
        }
    });

    // --- Action Listeners ---
    elements.runAuditBtn.addEventListener('click', handleRunAudit);
    elements.clearBtn.addEventListener('click', clearInputs);
    elements.loadSampleBtn.addEventListener('click', loadSample);
    elements.newAuditBtn.addEventListener('click', showInputSection);
    elements.exportPdfBtn.addEventListener('click', exportPDF);
    if (elements.navLogo) elements.navLogo.addEventListener('click', goHome);

    if (elements.landingStartBtn) elements.landingStartBtn.addEventListener('click', enterApp);
    if (elements.heroCtaBtn) elements.heroCtaBtn.addEventListener('click', enterApp);

    // --- Core Functions ---

    function enterApp() {
        elements.landingView.classList.add('hidden');
        elements.appView.classList.remove('hidden');
        elements.newAuditBtn.classList.add('hidden'); // Ensure New Audit button remains hidden initially
        elements.landingStartBtn.classList.add('hidden'); // Hide Start Audit in Nav
        window.scrollTo(0, 0);
    }

    function goHome() {
        elements.landingView.classList.remove('hidden');
        elements.appView.classList.add('hidden');
        elements.newAuditBtn.classList.add('hidden'); // Hide New Audit button
        elements.landingStartBtn.classList.remove('hidden'); // Show Start Audit in Nav
        window.scrollTo(0, 0);
    }

    async function handleRunAudit() {
        hideError();
        let rawHtml = '';
        let sourceName = 'Raw Input';

        try {
            if (activeTab === 'raw') {
                rawHtml = elements.htmlInput.value;
                if (!rawHtml.trim()) throw new Error("Please paste some HTML code.");

            } else if (activeTab === 'url') {
                const url = elements.urlInput.value.trim();
                if (!url) throw new Error("Please enter a URL.");
                // Note: This is a direct fetch attempt. 
                // In production, you'd likely need a proxy service for CORS.
                try {
                    const response = await fetch(url);
                    if (!response.ok) throw new Error(`Failed to fetch URL: ${response.statusText}`);
                    rawHtml = await response.text();
                    sourceName = url;
                } catch (err) {
                    throw new Error(`Could not load URL (CORS/Network error). Try pasting the source code instead.`);
                }

            } else if (activeTab === 'file') {
                const file = elements.fileInput.files[0];
                if (!file) throw new Error("Please upload a file.");
                rawHtml = await readFile(file);
                sourceName = file.name;
            }

            // Show Loading
            elements.loadingOverlay.classList.remove('hidden');

            // Random Delay 2-4 seconds
            const delay = Math.floor(Math.random() * 2000) + 2000;
            await new Promise(resolve => setTimeout(resolve, delay));

            // Run Engine
            const report = engine.run(rawHtml, sourceName);
            currentReport = report;
            renderReport(report);

            // Hide Loading & Show Results
            elements.loadingOverlay.classList.add('hidden');
            showResultsSection();

        } catch (err) {
            elements.loadingOverlay.classList.add('hidden');
            showError(err.message);
        }
    }

    function readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error("Error reading file"));
            reader.readAsText(file);
        });
    }

    function renderReport(report) {
        // Meta
        elements.metaDate.textContent = `Date: ${report.metadata.date}`;
        elements.metaLength.textContent = ` | Size: ${report.metadata.length} chars`;
        elements.metaSource.textContent = ` | Source: ${report.metadata.source}`;

        // Top Level Score
        elements.overallScoreVal.textContent = report.overallScore;
        updateScoreColor(document.getElementById('overall-score-circle'), report.overallScore, true);

        // Render Category Cards & Mini Scores
        elements.reportContainer.innerHTML = '';
        elements.categoryScoresContainer.innerHTML = '';

        report.categories.forEach(category => {
            // 1. Add to Score Dashboard
            const miniCard = document.createElement('div');
            miniCard.className = 'mini-score-card';
            miniCard.innerHTML = `
                <span>${category.name}</span>
                <span class="mini-score-value" style="color: ${getScoreColor(category.score)}">${category.score}</span>
            `;
            elements.categoryScoresContainer.appendChild(miniCard);

            // 2. Add Detailed Card
            const card = document.createElement('div');
            card.className = 'category-card';

            const list = document.createElement('div');
            list.className = 'issue-list';

            if (category.issues.length === 0) {
                list.innerHTML = `<div class="no-issues">No issues found. Score: 100/100</div>`;
            } else {
                category.issues.forEach(issue => {
                    const item = document.createElement('div');
                    item.className = `issue-item issue-${issue.severity.toLowerCase()}`;

                    let metaHtml = '';
                    if (issue.lineNumber) {
                        metaHtml += `<span class="meta-tag">Line ${issue.lineNumber}</span>`;
                    }
                    if (issue.context) {
                        // Escape HTML in snippets
                        const safeSnippet = issue.context.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                        metaHtml += `<code class="meta-code">${safeSnippet}</code>`;
                    }

                    // Create TIP HTML
                    let suggestionHtml = '';
                    if (issue.suggestion) {
                        suggestionHtml = `
                            <div class="issue-suggestion">
                                <span class="suggestion-icon">💡</span>
                                <span class="suggestion-text">${issue.suggestion}</span>
                            </div>
                        `;
                    }

                    item.innerHTML = `
                        <div class="issue-header">
                            <span>${issue.severity}</span>
                            ${metaHtml}
                        </div>
                        <div class="issue-desc">${issue.description}</div>
                        ${suggestionHtml}
                    `;
                    list.appendChild(item);
                });
            }

            card.innerHTML = `
                <div class="category-header">
                    <h3 class="category-title">${category.name}</h3>
                    <span style="font-weight:700; color:${getScoreColor(category.score)}">${category.score}/100</span>
                </div>
            `;
            card.appendChild(list);
            elements.reportContainer.appendChild(card);
        });
    }

    // --- Helpers ---

    function getScoreColor(score) {
        if (score >= 90) return 'var(--severity-good-text)'; // Needs to be defined or hex
        if (score >= 70) return '#b45309'; // Warning
        return '#b91c1c'; // Critical
    }

    function updateScoreColor(element, score, isBg = false) {
        // Simple conic gradient manipulation
        const color = getScoreColor(score);
        // We set the variable just for this element or use inline style
        // For simplicity:
        element.style.background = `conic-gradient(${color} ${score}%, var(--border-color) ${score}%)`;
    }

    function exportPDF() {
        if (!currentReport) return;
        const doc = new jsPDF();
        let y = 20;

        doc.setFontSize(22);
        doc.setFont(undefined, 'bold');
        doc.text("MarkupAudit Report", 20, y);
        doc.setFont(undefined, 'normal');
        y += 10;

        doc.setFontSize(12);

        // Color code overall score
        const score = currentReport.overallScore;
        if (score >= 90) doc.setTextColor(22, 163, 74); // Green
        else if (score >= 70) doc.setTextColor(180, 83, 9); // Orange
        else doc.setTextColor(185, 28, 28); // Red

        doc.text(`Overall Score: ${score}/100`, 20, y);
        doc.setTextColor(0, 0, 0); // Reset color
        y += 10;
        doc.text(`Source: ${currentReport.metadata.source}`, 20, y);
        y += 15;

        currentReport.categories.forEach((cat, index) => {
            if (y > 250) { doc.addPage(); y = 20; }

            // Category Header Color
            // 0: Semantics (Blue), 1: Access (Purple), 2: Hygiene (Green), 3: Completeness (Orange)
            if (index === 0) doc.setTextColor(37, 99, 235);
            else if (index === 1) doc.setTextColor(147, 51, 234);
            else if (index === 2) doc.setTextColor(22, 163, 74);
            else if (index === 3) doc.setTextColor(234, 88, 12);
            else doc.setTextColor(0, 0, 0);

            doc.setFontSize(16);
            doc.text(`${cat.name} (${cat.score})`, 20, y);
            y += 8;

            doc.setFontSize(11);
            doc.setTextColor(0, 0, 0); // Reset to Black for content
            if (cat.issues.length === 0) {
                doc.setTextColor(100, 100, 100);
                doc.text("- No issues found.", 25, y);
                y += 8;
            } else {
                cat.issues.forEach(issue => {
                    if (y > 270) { doc.addPage(); y = 20; }

                    // Severity Color
                    if (issue.severity === 'Critical') doc.setTextColor(185, 28, 28); // Red
                    else if (issue.severity === 'Warning') doc.setTextColor(180, 83, 9); // Orange
                    else doc.setTextColor(14, 116, 144); // Cyan (Info)

                    // Description
                    let descText = `[${issue.severity}] ${issue.description}`;
                    if (issue.lineNumber) descText += ` (Line ${issue.lineNumber})`;

                    doc.text(descText, 25, y);
                    y += 7;

                    // Context Snippet (Gray)
                    if (issue.context) {
                        doc.setTextColor(100, 116, 139); // Slate 500
                        doc.setFontSize(10);
                        doc.text(`Code: ${issue.context.substring(0, 80)}`, 30, y);
                        doc.setFontSize(11); // Reset
                        y += 6;
                    }

                    // Recommendation / Suggestion (Green-ish)
                    if (issue.suggestion) {
                        doc.setTextColor(21, 128, 61); // Green 700
                        doc.setFont(undefined, 'italic');
                        doc.text(`Tip: ${issue.suggestion}`, 30, y);
                        doc.setFont(undefined, 'normal');
                        y += 6;
                    }

                    y += 2; // Extra spacing
                });
            }
            y += 10;
        });
        doc.save("audit-report.pdf");
    }

    function clearInputs() {
        elements.htmlInput.value = '';
        elements.urlInput.value = '';
        elements.fileInput.value = '';
        elements.fileNameDisplay.textContent = '';
        hideError();
    }

    function showInputSection() {
        elements.inputSection.classList.remove('hidden');
        elements.resultsSection.classList.add('hidden');
        elements.newAuditBtn.classList.add('hidden');
    }

    function showResultsSection() {
        elements.inputSection.classList.add('hidden');
        elements.resultsSection.classList.remove('hidden');
        elements.newAuditBtn.classList.remove('hidden');
        window.scrollTo(0, 0);
    }

    function showError(msg) {
        elements.errorMessage.textContent = msg;
        elements.errorMessage.classList.remove('hidden');
    }

    function hideError() {
        elements.errorMessage.classList.add('hidden');
    }

    function loadSample() {
        if (activeTab !== 'raw') {
            alert("Switch to 'Raw HTML' tab to load sample.");
            return;
        }
        elements.htmlInput.value = `<!DOCTYPE html>
<html lang=""> <!-- Missing Lang -->
<head>
    <title></title> <!-- Empty Title -->
</head>
<body>
    <header><h1>My Site</h1></header>
    <div>
        <!-- Semantic: Missing Main -->
        <img src="logo.png"> <!-- Accessibility: Missing Alt -->
        <div style="color:red"> <!-- Hygiene: Inline Style -->
             <button></button> <!-- Access: Empty Button -->
        </div>
    </div>
</body>
</html>`;
    }
});
