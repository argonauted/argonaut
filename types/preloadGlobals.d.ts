export interface IOpenSaveApi {
  loadConfig: (onOpen) => void
  saveFileAs: (fileMetadata,data,onSave) => void,
  saveFile: (fileMetadata,data,onSave) => void,
  openFile: (onOpen) => void
}

declare global {
  interface Window {
    openSaveApi: IOpenSaveApi
  }
}