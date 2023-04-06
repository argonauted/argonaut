

export interface DocEnvUpdateData {
    lineId: string,
    cmdIndex: number,
    changes: {
        version: string,
        adds?: Record<string,any>
        drops?: string[]
    }
}

export type VarTable = {
    version: string,
    table: Record<string,any>
}


export function getEmptyVarTable() {
    return {
        version: "",
        table: {}
    }
}

export function getUpdatedVarTable(varTable: VarTable, update: DocEnvUpdateData) {
    if(!update.changes) return varTable
    
    let newTable: Record<string,any> = {}
    Object.assign(newTable,varTable.table)
    if(update.changes.adds !== undefined) {
        for(let key in update.changes.adds) {
            newTable[key] = update.changes.adds[key]
        }
    }
    if(update.changes.drops !== undefined) {
        update.changes.drops.forEach(key => delete newTable[key])
    }
    return {
        version: getVersion(update),
        table: newTable
    }
}

function getVersion(update: DocEnvUpdateData) {
    return update.lineId + "|" + update.cmdIndex
}

export function lookupValue(varTable: VarTable, key: string) {
    return varTable.table[key]
}