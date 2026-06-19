@echo off
cd /d C:\Users\jacks\OneDrive\Desktop\Ice-Crawler-AGNT-Plugin

echo Step 1: Initialize git repo
git init

echo Step 2: Create .gitignore
echo node_modules/ > .gitignore
echo build/ >> .gitignore
echo dist/ >> .gitignore
echo .DS_Store >> .gitignore
echo *.log >> .gitignore
echo state/ >> .gitignore

echo Step 3: Add all files
git add -A

echo Step 4: First commit
git commit -m "feat: ICE Crawler AGNT Plugin v1.0.0 — triadic zero-trace repository ingestion engine"

echo Step 5: Set remote
git remote add origin https://github.com/jacksonjp0311-gif/ICE-CRAWLER-AGNT-Plugin.git

echo Step 6: Verify
git status
git remote -v
dir /b

echo.
echo ============================================
echo  REPO READY — Next: git push -u origin main
echo ============================================
