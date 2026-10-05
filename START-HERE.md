# Run Power Reader on your computer

## One-time setup (about 10 minutes)

1. **Install Node.js.** Go to https://nodejs.org, download the **LTS** version and run the installer.
2. **Get the code.** On https://github.com/pcharman1974/fluencyapp click the green **Code** button,
   then **Download ZIP**. Unzip it somewhere easy, such as your Desktop.
3. **Open a terminal in the `app` folder.**
   - Mac: open the unzipped folder in Finder, right-click the `app` folder and choose
     **New Terminal at Folder**.
   - Windows: open the `app` folder in File Explorer, click the address bar, type `cmd` and press Enter.
4. Type this and press Enter (it downloads what the app needs):

   ```
   npm install
   ```

## Every time you want to run it

In a terminal in the `app` folder, type:

```
npm start
```

It shows the addresses to open:

- **On the same computer:** http://localhost:8787
- **On an iPad:** the `http://192.168…:8787` address it prints (the iPad must be on the same Wi-Fi).

Press **Ctrl+C** in the terminal to stop it.

## Turning on the real speech check (optional)

1. Ask IT for an **Azure AI Speech** resource key and region (for example `uksouth`).
2. In the `app` folder, copy `.env.example` to a new file called `.env` and fill in the two values.
3. Run `npm start` again. The **Speech check** option will now be available.

The microphone works in a browser on the computer running the app. On an iPad, Safari only
allows the microphone on a secure (`https://`) address, so the speech check on iPads needs
the app put on a proper web host. Adult marking and demo mode work on an iPad either way.
