/** This file loads and maintain the package level data from the session. This is common to all
 * docSessions. */

import { addEventListener } from "../session/sessionApi"

//The values for the package members
export let libVarData: any[] = []

//this is specific to completions, I guess that is ok
export let libCompletionVarNames: string[] = []
export let libCompletionVarTypes: string[] = []
//let libFunctionMap: Record<string,string> = {}  //NOT USED NOW!

//========================================
// Library Data Loading Funtions
//========================================
function processEnvData(eventName: string, data: any) {

    libVarData = data

    libCompletionVarNames = []
    libCompletionVarTypes = []
    // libFunctionMap = {}
    data.forEach( (packageData:any) => {
        var keys = Object.keys(packageData.var)
        let pkgVarNames = keys.filter( (name: string) => !name.startsWith("."))
        let pkgVarTypes = pkgVarNames.map( (name: string) => packageData.var[name].type == "function" ? "function" : "variable" )
        libCompletionVarNames = libCompletionVarNames.concat(pkgVarNames)
        libCompletionVarTypes = libCompletionVarTypes.concat(pkgVarTypes)

        //get function list for cursor tooltip
        // let libFunctionNames = pkgVarNames.filter( (name: string, index: number) => pkgVarTypes[index] == "function")
        // libFunctionNames.forEach( (functionName: string) => {
        //     let signature = packageData.var[functionName].signature
        //     if(!libFunctionMap[functionName]) libFunctionMap[functionName] = signature
        // })
    })
}

function addPkgData(eventName: string, pkgData: any) {

    libVarData.push(pkgData)

    var keys = Object.keys(pkgData.var)
    let pkgVarNames = keys.filter( (name: string) => !name.startsWith("."))
    let pkgVarTypes = pkgVarNames.map( (name: string) => pkgData.var[name].fmt == "function" ? "function" : "variable" )
    libCompletionVarNames = libCompletionVarNames.concat(pkgVarNames)
    libCompletionVarTypes = libCompletionVarTypes.concat(pkgVarTypes)

    //get function list for cursor tooltip
    // let libFunctionNames = pkgVarNames.filter( (name: string, index: number) => pkgVarTypes[index] == "function")
    // libFunctionNames.forEach( (functionName: string) => {
    //     let signature = packageData.var[functionName].signature
    //     if(!libFunctionMap[functionName]) libFunctionMap[functionName] = signature
    // })
}

//addEventListener("envData", processEnvData)
addEventListener("pkgData", addPkgData)
