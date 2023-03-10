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
	dummy: () => ipcRenderer.invoke("fileAccess:dummy")
})

contextBridge.exposeInMainWorld('utilApi', {
	getFilePath: relPath => ipcRenderer.invoke("utilapi:getfilepath",relPath)
	
})
