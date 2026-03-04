#!/bin/bash
# Setup PDF Generation Skill
# Installs Python reportlab library for PDF generation

echo "Setting up PDF generation skill..."

# Check if reportlab is already installed
if python3 -c "import reportlab" 2>/dev/null; then
    echo "✓ reportlab already installed"
else
    echo "Installing reportlab..."
    pip install reportlab --break-system-packages 2>/dev/null || pip install reportlab --user 2>/dev/null
    
    if python3 -c "import reportlab" 2>/dev/null; then
        echo "✓ reportlab installed successfully"
    else
        echo "✗ Failed to install reportlab"
        exit 1
    fi
fi

# Verify installation
python3 -c "from reportlab.lib.pagesizes import A4; print('✓ PDF generation ready')"

echo ""
echo "PDF Skill Setup Complete"
echo "Usage: python3 scripts/create_user_manual_pdf.py"
