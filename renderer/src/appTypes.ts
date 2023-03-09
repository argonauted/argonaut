

export type DocSession = {
    id: string
    lastSavedText?: string
    filePath?: string
    isDirty: boolean
    editor: Editor | null
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
