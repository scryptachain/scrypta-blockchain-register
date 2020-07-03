const express = require('express')
const daemon = express()
const port = 8080
const fs = require('fs')
const { app, Menu, Tray } = require('electron')

let tray = null;
app.on('ready', () => {
    let path = app.getAppPath()
    
    daemon.use(express.static(path + '/dist'))
    
    daemon.get('/', (req, res) => {
        let index = fs.readFileSync( path + '/dist/index.html' )
        res.end(index)
    })
    
    daemon.listen(port, () => console.log(`Scrypta Blockchain Register listening at http://localhost:${port}`))

    tray = new Tray( path + '/dist/logo.png')
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Open manager', click: () => { require("electron").shell.openExternal("http://localhost:" + port) } },
        { label: 'Quit', click: () => { app.quit() } },
    ]);
    tray.setToolTip('Scrypta Blockchain Register.')
    tray.setContextMenu(contextMenu)
})