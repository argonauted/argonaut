const {app, BrowserWindow} = require('electron')
const path = require('path')
const { spawn, ChildProcess, execSync } = require('child_process')
const http = require('http')
const process = require('process')
const { v4 } = require('uuid')
const crc = require('crc')
const { randomUUID } = require('crypto') //dont know why a different one is used. maybe just because its a different place

let windows = [];

//===================================
// utilities
//====================================
function callbackRequest(url,onSuccess,onError,options) {
    
    var xmlhttp=new XMLHttpRequest();

    xmlhttp.onreadystatechange=function() {
        var msg;
        if(xmlhttp.readyState==4) {
            if((xmlhttp.status>=200)&&(xmlhttp.status<=399)) {
                try {
                    onSuccess(xmlhttp.responseText);
                }
                catch(error) {
                    onError(error.message);
                }

            }
            else if(xmlhttp.status >= 400)  {
                msg = "Error in http request. Status: " + xmlhttp.status;
                onError(msg);
            }
            else if(xmlhttp.status == 0) {
                msg = "Preflight error in request. See console";
                onError(msg);
            }
        }
    }

    if(!options) options = {};
    
    var method = options.method ? options.method : "GET";
    xmlhttp.open(method,url,true);
    
    if(options.header) {
        for(var key in options.header) {
            xmlhttp.setRequestHeader(key,options.header[key]);
        }
    }
    
    xmlhttp.send(options.body);
}

//from core/environment.ts
/**
 * Get value of process environment variable; returns empty string it not found.
 */
function getenv(name) {
  let value = process.env[name]
  return value ? value : ''
}

//from core/environment.ts
/**
 * Add given name=value to process environment.
 */
function setenv(name, value) {
  process.env[name] = value
}

//from core/system.ts
function localPeer(port) {
    // local peer used for named-pipe communication on Windows
    return `\\\\.\\pipe\\${port.toString()}-rsession`
}

//from core/system.ts
function generateUuid(includeDashes = true) {
    let uuid = v4()
    if (!includeDashes) {
      uuid = uuid.replace(/-/g, '')
    }
    return uuid
  }

//from core/system.ts
function generateShortenedUuid() {
    return crc.crc32(generateUuid(false)).toString(16)
}

//=============================================
// App/Electron Code
//=============================================

function createWindow(workspaceUrl) {
    // Create the browser window.
    let win = new BrowserWindow({
        width: 800, 
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        }
    })
    win.setMenu(null)
    
    // Open the DevTools.
    win.webContents.openDevTools() 

    /////////////////////////////
    //set env variables that I might need???
    if (getenv('PYTHONIOENCODING') === '') {
        setenv('PYTHONIOENCODING', 'utf-8');
    }

    //const rPath = "C:\\Program Files\\R\\R-4.2.2"
    //setenv('RSTUDIO_WHICH_R', rPath);


    setenv("R_ARCH","x64")
    setenv("R_DOC_DIR","C:/PROGRA~1/R/R-42~1.2/doc")
    setenv("R_HOME","C:/PROGRA~1/R/R-42~1.2")
    setenv("R_INCLUDE_DIR","C:/PROGRA~1/R/R-42~1.2/include")
    setenv("R_RUNTIME","ucrt")
    setenv("R_SHARE_DIR","C:/PROGRA~1/R/R-42~1.2/share")

    
    setenv("Path","C:\\Program Files\\R\\R-4.2.2\\bin\\x64" + ";" + getenv("Path"))

    //////////////////////////////

    /////////////////////////////////////
    const sharedSecret = randomUUID();
    setenv('RS_SHARED_SECRET', sharedSecret);

    let port = 36885
    let launcherToken = generateShortenedUuid()
    let argList = ['--program-mode','desktop','--www-port',String(port),'--launcher-token',launcherToken,'--config-file','none'/*,'--verify-installation','1'*/]

    //---------------------
    //const runtime = getenv('R_RUNTIME');
    //---------------------

    //in sessionlauncher "buildLaunchContext"
    setenv('RS_LOCAL_PEER', localPeer(port));

    //const appPath = path.join(path.dirname(app.getAppPath()), 'app')
    const appPath = "C:\\Program Files\\RStudio\\resources\\app"



    let confPath = "";
    let cmd = "C:\\Program Files\\RStudio\\resources\\app\\bin\\rsession-utf8.exe"
    //let cmd = '"C:/Program Files/RStudio/resources/app/bin/rsession-utf8.exe"'
    //let cwd = "C:/Program Files/RStudio/resources/app/.webpack/main"
    //let cwd = appPath

    console.log(`abspath=${cmd},t=${argList},env=${JSON.stringify(process.env)}}`)

    let proc = spawn(cmd, argList, {  /*stdio: 'inherit',*//*cwd: cwd,*//* shell: true, */env:process.env })

    proc.on('error', (err) => {
    // Unable to start rsession (at all)
    console.error(err)
    });

    proc.on('exit', (code, signal) => {
    console.log("RSession exited!")
    });

    proc.on('message', (msgObj) => {
        console.log(JSON.stringify(msgObj))
    });

    // capture stdout and stderr for diagnostics
    proc.stdout?.on('data', (data) => {
    console.log(data.toString())
    });

    proc.stderr?.on('data', (data) => {
    console.error(data.toString())
    });

    let postData0 =  JSON.stringify({
        "method": "get_events",
        "params": [1],
        "clientId": "33e600bb-c1b1-46bf-b562-ab5cba070b0e",
        "clientVersion": ""
    })
    let options0 = {
        hostname: "127.0.0.1",
        port: port,
        path: "/events/get_events",
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(postData0),
            "X-Shared-Secret": sharedSecret,
            "X-RStudio-Refresh-Auth-Creds": 0,
            "X-RS-RID": 435234559
        }
    }

    let postData1 =  JSON.stringify({
        "method": "console_input",
        "params": [
            "78 + 45",
            "",
            0
        ],
        "clientId": "33e600bb-c1b1-46bf-b562-ab5cba070b0e",
        "clientVersion": ""
    })
    let options1 = {
        hostname: "127.0.0.1",
        port: port,
        path: "/rpc/console_input",
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(postData1),
            "X-Shared-Secret": sharedSecret,
            "X-RStudio-Refresh-Auth-Creds": 0,
            "X-RS-RID": -1080868359
        }
    }
    let postData2 =  JSON.stringify({
        "method": "get_events",
        "params": [5],
        "clientId": "33e600bb-c1b1-46bf-b562-ab5cba070b0e",
        "clientVersion": ""
    })
    let options2 = {
        hostname: "127.0.0.1",
        port: port,
        path: "/events/get_events",
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(postData2),
            "X-Shared-Secret": sharedSecret,
            "X-RStudio-Refresh-Auth-Creds": 0,
            "X-RS-RID": 506878359
        }
    }

    let processRes = res => {
        console.log(`STATUS: ${res.statusCode}`)
        console.log(`HEADERS: ${JSON.stringify(res.headers)}`)
        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          console.log(`BODY: ${chunk}`)
        })
        res.on('end', () => {
          console.log('No more data in response.')
        })
    }
    let processErr = e => {
        console.error(`problem with request: ${e.message}`);
    }

    let tryIt = () => {
        const req0 = http.request(options0,processRes)
        req0.on('error', processErr);
          
        // Write data to request body
        req0.write(postData0);
        req0.end();

        const req1 = http.request(options1,processRes)
        req1.on('error', processErr);
          
        // Write data to request body
        req1.write(postData1);
        req1.end();

        const req2 = http.request(options2,processRes)
        req1.on('error', processErr);
          
        // Write data to request body
        req2.write(postData2);
        req2.end();
    }

    setTimeout(tryIt,3000)

    /////////////////////////////////////

    // and load the index.html of the app.
    win.loadURL(getAppWindowUrl(workspaceUrl));  
  
    win.on('close',(e) => {
        const {dialog} = require('electron');
 
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
app.on('ready', () => createWindow())

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
        createWindow()
    }
})

/** This function gets the URL to open he app window. */
function getAppWindowUrl(workspaceUrl) {
    let url = "file://" + path.join(__dirname, '../web/editor.html');
    if(workspaceUrl) {
        url += "?url=" + workspaceUrl;
    }
    return url;
}


/*

private createMessageClient() {
    const options = { path: 'rstudio', retries: 10 };
    this.client = new Client(options);

    // connect to primary RStudio instance
    this.client.connect({ path: 'rstudio' })
      .then(() => logger().logDebug(`net-ipc: ${process.pid} connected to primary instance`))
      .catch((error: unknown) => logger().logError(error));

    this.client.on('close', (reason: unknown) => {
      logger().logDebug(`net-ipc: ${process.pid} server close event ${reason}`);

      // close out connection to primary instance that just quit
      // another connection will be created to either be the primary or listen to the new primary instance
      this.client?.close()
        .then(() => logger().logDebug(`net-ipc: ${process.pid} close client connection`))
        .catch((error: unknown) => logger().logError(error))
        .finally(() => this.client = undefined);

      const instanceLock = app.requestSingleInstanceLock();
      if (instanceLock) {
        this.createMessageServer();
      } else {
        this.createMessageClient();
      }
    });
  }

  
  // create a new local socket to co-ordinate and become the primary instance
  private createMessageServer() {
    const options = { path: 'rstudio' };
    this.server = new Server(options);
    logger().logDebug('net-ipc: creating new message server');
    this.server.start()
      .then(() => {
        this.client = undefined;
        logger().logDebug(`net-ipc: ${process.pid} taking over as primary instance`);
      })
      .catch((error: unknown) => logger().logError(`net-ipc: ${process.pid} ${error}`));
  }
*/



