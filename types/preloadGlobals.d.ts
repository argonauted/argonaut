export interface IRSessionApi {
  sendRpcRequest: (scope: string, method: string, params: Array<any>) => Promise<Object>
  getBinary: (fileName: string) => Promise<Object>
}

// export interface IOpenSaveApi {
//   loadConfig: (onOpen) => void
//   saveFileAs: (fileMetadata,data,onSave) => void,
//   saveFile: (fileMetadata,data,onSave) => void,
//   openFile: (onOpen) => void
// }

declare global {
  interface Window {
    rSessionApi: IRSessionApi,
    // openSaveApi: IOpenSaveApi
  }
}