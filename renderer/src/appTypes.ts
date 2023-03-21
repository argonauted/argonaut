

export type DocSession = {
    id: string
    lastSavedText?: string
    filePath?: string
    fileName: string
    fileExtension: string
    isDirty: boolean
    editor: Editor | null
}

export interface DocSessionUpdate {
    lastSavedText?: string
    filePath?: string
    fileName?: string
    fileExtension?: string
    isDirty?: boolean
}


export interface Editor {
    //getData: () => string,
    //destroy: () => void
}

export interface TabState {
    id: string
    label: string
    isDirty: boolean
    type: string
}

export interface TabFunctions {
    selectTab: (tabId: string) => void
    closeTab: (tabId: string) => void
    getTabElement: (tabState: TabState, isShowing: boolean) => React.ReactNode
}
