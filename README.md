# Tiny Snack Rush

A cute browser cooking time-management game made with plain HTML, CSS, and JavaScript.

## Project Files

Keep this structure together when uploading to GitHub:

```text
index.html
style.css
game.js
manifest.json
assets/
.nojekyll
```

Do not move files out of `assets/`, because the game loads images, fonts, and sprites from that folder.

## Test Locally

You can test by opening `index.html` in a browser.

For a more reliable local test, run this command inside this folder:

```powershell
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Publish With GitHub Pages

1. Create a GitHub account or sign in.
2. Click **New repository**.
3. Name the repository, for example:

```text
tiny-snack-rush
```

4. Choose **Public**.
5. Click **Create repository**.
6. Click **uploading an existing file**.
7. Drag these files and folders into GitHub:

```text
index.html
style.css
game.js
manifest.json
assets/
.nojekyll
README.md
```

8. Click **Commit changes**.
9. Open the repository **Settings** tab.
10. Open **Pages** in the left menu.
11. Under **Build and deployment**, set:

```text
Source: Deploy from a branch
Branch: main
Folder: /root
```

12. Click **Save**.
13. Wait a minute or two.
14. GitHub will show your public game link. It will look like:

```text
https://your-username.github.io/tiny-snack-rush/
```

## Updating The Game Later

1. Edit the files on your computer.
2. Upload the changed files to the same GitHub repository.
3. Click **Commit changes**.
4. Wait a minute for GitHub Pages to refresh.

If the old version still appears, refresh the browser or open the link in a private/incognito window.
