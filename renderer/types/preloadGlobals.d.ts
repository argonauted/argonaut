export interface IRSessionApi {
  sendRpcRequest: (scope: string, method: string, params: Array<any>) => Promise<Object>
  getBinary: (fileName: string) => Promise<Object>
}

export interface IOpenSaveApi {
  saveFileAs: (data: string, filePath: string | undefined) => Promise<string>,
  saveFile: (data: string, filePath: string) => Promise<string>,
  openFile: () => Promise<{data: string, filePath: string} | null>
}

// export interface IUtilApi {
//   getFilePath: (relPath: string) => Promise<string>
// }

// export interface IOpenSaveApi {
//   loadConfig: (onOpen) => void
//   saveFileAs: (fileMetadata,data,onSave) => void,
//   saveFile: (fileMetadata,data,onSave) => void,
//   openFile: (onOpen) => void
// }

declare global {
  interface Window {
    rSessionApi: IRSessionApi,
    openSaveApi: IOpenSaveApi
  }
}