/** This file provides functions to read data values from the document and cells in the document. */

export interface DocEnvUpdateData {
    lineId: string,
    cmdIndex: number,
    changes: {
        version: string,
        adds?: Record<string,any>
        drops?: string[]
    }
}

export type RValueStruct = any

export type VarTable = {
    version: string,
    table: Record<string,RValueStruct>
}

export type CellEnv = Record<string, string>

export function getEmptyVarTable() {
    return {
        version: "",
        table: {}
    }
}

export const EMPTY_CELL_ENV: CellEnv = {}

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

export function lookupDocValue(key: string, varTable: VarTable) {
    return varTable.table[key]
}

export function lookupCellValue(varName: string, cellEnv: CellEnv, varTable: VarTable, functionOnly: boolean) {
    let versionedVarName = cellEnv[varName]
    if (versionedVarName !== undefined) {
        let varValue = varTable.table[versionedVarName]
        if (varValue !== undefined && (!functionOnly || varValue.fmt == "function")) {
            return varValue
        }
    }
    return null
}

/** This gets the child names from a list-type object */
export function getListNames(callerValue: any): string[] | null {
    if (callerValue.fmt == "list" && callerValue.names !== undefined) {
        return callerValue.names.filter((name: string) => name !== "")
    }
    else if (callerValue.fmt == "data.frame" && callerValue.colNames !== undefined) {
        return callerValue.colNames.filter((name: string) => name !== "")
    }
    return null
}
