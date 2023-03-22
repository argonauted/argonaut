const {contextBridge, ipcRenderer} = require('electron')

contextBridge.exposeInMainWorld('rSessionApi', {
	//for now, I will just manage the connection in the renderer
	sendRpcRequest: (scope,method,params) =>  ipcRenderer.invoke("rsession:sendrpcrequest",scope,method,params),
	getBinary: fileName => ipcRenderer.invoke("ressions:getbinary",fileName)
})

contextBridge.exposeInMainWorld('openSaveApi', {
	saveFileAs: ( data: string, filePath: string) => ipcRenderer.invoke("fileAccess:saveFileAs",data,filePath),
	saveFile: ( data: string, filePath: string) => ipcRenderer.invoke("fileAccess:saveFile",data,filePath),
	openFile: () => ipcRenderer.invoke("fileAccess:openFile"),
})

contextBridge.exposeInMainWorld('dialogApi', {
	alertDialog: (body: string, type?: string, okText?: string) => ipcRenderer.invoke("dialog:alertDialog",body, type, okText),
	okCancelDialog: (body: string, type?: string, okText?: string, cancelText?: string) => ipcRenderer.invoke("dialog:okCancelDialog",body, type, okText, cancelText),
	messageDialog: (body: string, type: string, buttons: [string], defaultId?: number, cancelId?: number) => ipcRenderer.invoke("dialog:messageDialog",body, type, buttons, defaultId, cancelId),
	errorDialog: (title: string, body: string) => ipcRenderer.invoke("dialog:errorDialog",title, body)
})

contextBridge.exposeInMainWorld('forceCloseBrowserWindow', () => ipcRenderer.invoke('forceCloseBrowserWindow'))

contextBridge.exposeInMainWorld('utilApi', {
	getFilePath: relPath => ipcRenderer.invoke("utilapi:getfilepath",relPath)
	
})
