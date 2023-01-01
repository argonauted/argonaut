export interface IRSessionApi {
  sendCommand: (cmdText: string) => Promise<Object>
  getEvents: (index: number) => Promise<Object>
  getGraphics: (fileName: string) => Promise<Object>
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