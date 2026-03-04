# TC Work Zone Locator - Scripts Directory

## PDF Generation Skill

The PDF generation skill allows creating PDF documents using Python's `reportlab` library.

### Setup

Run the setup command to install the required Python library:

```bash
bun run setup:pdf
# or
npm run setup:pdf
# or directly
pip install reportlab --break-system-packages
```

### Usage

To generate a PDF document, use the Python script:

```bash
python3 scripts/create_user_manual_pdf.py
```

The output will be saved to `/home/z/my-project/download/`

### Available Scripts

| Script | Description |
|--------|-------------|
| `setup-pdf-skill.sh` | Installs reportlab for PDF generation |
| `create_user_manual_pdf.py` | Generates User Manual PDF |
| `create-user-manual.js` | Generates User Manual Word document |
| `version-check.sh` | Checks version consistency across docs |
| `download-roads.js` | Downloads road data from MRWA |
| `download-signage.mjs` | Downloads signage data |
| `generate-rc-docs.js` | Generates RC documentation |
| `generate-rc121-doc.mjs` | Generates RC 1.2.1 supplement |
| `update-*.mjs` | Various doc update scripts |

### PDF Generation from Markdown

To create a PDF from any markdown file, you can adapt the `create_user_manual_pdf.py` script:

1. Read the markdown content
2. Convert to PDF using reportlab
3. Save to the download directory

### Dependencies

- Python 3.12+
- reportlab (`pip install reportlab`)
- pillow (installed with reportlab)
- charset-normalizer (installed with reportlab)

---

**Note:** PDF files are generated to `/home/z/my-project/download/` directory.
