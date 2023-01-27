import {app, BrowserWindow, dialog, ipcMain} from 'electron'
import process from 'process'
import { RSession } from './RSession'
import path from 'path'

let windows = []

const APP_FILE = "./renderer/web/index.html"
//const APP_FILE = "./renderer/web/editor.html"

let rSession = new RSession()

//=============================================
// App/Electron Code
//=============================================

function createWindow(fileName) {
    // Create the browser window.
    let win = new BrowserWindow({
        width: 800, 
        height: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
			preload: path.join(__dirname, "preload.js")
        }
    })
    win.setMenu(null)
    
    // Open the DevTools.
    win.webContents.openDevTools() 

    // and load the index.html of the app.
    win.loadFile(fileName);  
  
    win.on('close',(e) => {
 
        var isDirtyPromise = win.webContents.executeJavaScript("getIsDirty()");
        isDirtyPromise.then( (isDirty) => {
            if(isDirty) {
				console.log("about to show dialog");
                var resultPromise = dialog.showMessageBox({
                    message: "There is unsaved data. Are you sure you want to exit?",
                    buttons: ["Exit","Stay"]
                });
                resultPromise.then( result => {
                    if(result.response == 0) win.destroy();
                })
            }
            else {
                win.destroy();
            }
        }).catch( (msg) => {
            //just detroy
            console.log("Error in close check. Exiting");
            win.destroy();
        })
        
        //we won't close here - we will use promise result above
        e.preventDefault();
    });

    // Emitted when the window is closed.
    win.on('closed', () => {
        let index = windows.indexOf(win);
        windows.splice(index,1);
    })

    windows.push(win);
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
    //start the R session
    rSession.initSession()

    ipcMain.handle('rsession:sendrpcrequest',sendRpcRequest)
    ipcMain.handle('ressions:getbinary',getBinary)
    ipcMain.handle('utilapi:getfilepath',getFilePath)

    createWindow(APP_FILE)
})

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (windows.length == 0) {
        createWindow(APP_FILE)
    }
})

function sendRpcRequest(event: any, scope: string, method: string, params: Array<any>) {
    return rSession.sendRpcRequest(scope,method,params)
}

function getBinary(event: any,fileName: string) {
    return rSession.getBinary(fileName)
}

function getFilePath(event: any,relPath: string) {
    return path.join(__dirname,relPath)
}

