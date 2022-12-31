import { spawn } from 'child_process'
import http from 'http'
import process from 'process'
import { randomUUID } from 'crypto' //dont know why a different one is used. maybe just because its a different place
import { getenv, setenv, localPeer, generateShortenedUuid, getMessageId } from './rSessionUtils'
import {dialog} from 'electron'

export class RSession {
    sharedSecret: string
    port: number
    launcherToken: string
    eventsUrl: string
    commandUrl: string

    constructor() {

    }

    initSession() {
        /////////////////////////////
        //set env variables that I might need???
        if (getenv('PYTHONIOENCODING') === '') {
            setenv('PYTHONIOENCODING', 'utf-8');
        }

        //const rPath = "C:\\Program Files\\R\\R-4.2.2"
        //setenv('RSTUDIO_WHICH_R', rPath);


        setenv("R_ARCH","x64")
        setenv("R_DOC_DIR","C:/PROGRA~1/R/R-42~1.2/doc")
        setenv("R_HOME","C:/PROGRA~1/R/R-42~1.2")
        setenv("R_INCLUDE_DIR","C:/PROGRA~1/R/R-42~1.2/include")
        setenv("R_RUNTIME","ucrt")
        setenv("R_SHARE_DIR","C:/PROGRA~1/R/R-42~1.2/share")

        
        setenv("Path","C:\\Program Files\\R\\R-4.2.2\\bin\\x64" + ";" + getenv("Path"))

        //////////////////////////////

        /////////////////////////////////////
        this.sharedSecret = randomUUID()
        setenv('RS_SHARED_SECRET', this.sharedSecret)

        this.port = 36885
        this.launcherToken = generateShortenedUuid()
        let argList = ['--program-mode','desktop','--www-port',String(this.port),'--launcher-token',this.launcherToken,'--config-file','none'/*,'--verify-installation','1'*/]

        //---------------------
        //const runtime = getenv('R_RUNTIME');
        //---------------------

        //in sessionlauncher "buildLaunchContext"
        setenv('RS_LOCAL_PEER', localPeer(this.port));

        //const appPath = path.join(path.dirname(app.getAppPath()), 'app')
        const appPath = "C:\\Program Files\\RStudio\\resources\\app"



        let confPath = "";
        let cmd = "C:\\Program Files\\RStudio\\resources\\app\\bin\\rsession-utf8.exe"
        //let cmd = '"C:/Program Files/RStudio/resources/app/bin/rsession-utf8.exe"'
        //let cwd = "C:/Program Files/RStudio/resources/app/.webpack/main"
        //let cwd = appPath

        let proc = spawn(cmd, argList, {  /*stdio: 'inherit',*//*cwd: cwd,*//* shell: true, */env:process.env })

        proc.on('error', (err) => {
        // Unable to start rsession (at all)
        console.error(err)
        });

        proc.on('exit', (code, signal) => {
        console.log("RSession exited!")
        });

        proc.on('message', (msgObj) => {
            console.log(JSON.stringify(msgObj))
        });

        // capture stdout and stderr for diagnostics
        proc.stdout?.on('data', (data) => {
        console.log(data.toString())
        });

        proc.stderr?.on('data', (data) => {
        console.error(data.toString())
        });

        this.eventsUrl = `http://127.0.0.1:${this.port}/events/get_events`
        this.commandUrl = `http://127.0.0.1:${this.port}/rpc/console_input`
    }

    sendCommand(cmdText: string) {
        let body =  JSON.stringify({
            "method": "console_input",
            "params": [
                cmdText,
                "",
                0
            ],
            "clientId": "33e600bb-c1b1-46bf-b562-ab5cba070b0e",
            "clientVersion": ""
        })
        let options = {
            method: "POST",
            body: body,
            headers: {
                "Content-Type": "application/json",
                "Content-Length": String(Buffer.byteLength(body)),
                "X-Shared-Secret": this.sharedSecret,
                "X-RStudio-Refresh-Auth-Creds": String(0),
                "X-RS-RID": String(getMessageId())
            }
            
        }
        return doRequest(this.commandUrl,options,body)
    }

    getEvents(index: number) {
        console.log("Request event index = " + index)
        let body =  JSON.stringify({
            "method": "get_events",
            "params": [index],
            "clientId": "33e600bb-c1b1-46bf-b562-ab5cba070b0e",
            "clientVersion": ""
        })
        let options = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": String(Buffer.byteLength(body)),
                "X-Shared-Secret": this.sharedSecret,
                "X-RStudio-Refresh-Auth-Creds": String(0),
                "X-RS-RID": String(getMessageId())
            }
            
        }
        return doRequest(this.eventsUrl,options,body)
    }
}

function doRequest(url,options,body: string | null) {
    return new Promise((resolve,reject) => {
        let processRes = (res) => {
            let response: Record<string,string> = {}
            response.statusCode = res.statusCode
            response.headers = res.headers
            let data = ""
        
            res.setEncoding('utf8')
            res.on('data', (chunk) => {
                data = data + chunk
            })
            res.on('end', () => {
                if(data.length > 0) {
                    //need error checking!!!
                    response.data = JSON.parse(data)
                }
                resolve(response)
            })
        }
        let processErr = (e) => {
            reject(e)
        }

        const req = http.request(url,options,processRes)
        req.on('error', processErr)
        if(body !== null) {
            req.write(body!)
        }
        req.end()
    })
}


    

    



    // runTest() {
    //     let postData0 =  JSON.stringify({
    //         "method": "get_events",
    //         "params": [0],
    //         "clientId": "33e600bb-c1b1-46bf-b562-ab5cba070b0e",
    //         "clientVersion": ""
    //     })
    //     let options0 = {
    //         hostname: "127.0.0.1",
    //         port: this.port,
    //         path: "/events/get_events",
    //         method: "POST",
    //         headers: {
    //             "Content-Type": "application/json",
    //             "Content-Length": Buffer.byteLength(postData0),
    //             "X-Shared-Secret": this.sharedSecret,
    //             "X-RStudio-Refresh-Auth-Creds": 0,
    //             "X-RS-RID": 435234559
    //         }
    //     }

    //     let postData1 =  JSON.stringify({
    //         "method": "console_input",
    //         "params": [
    //             "78 + 45",
    //             "",
    //             0
    //         ],
    //         "clientId": "33e600bb-c1b1-46bf-b562-ab5cba070b0e",
    //         "clientVersion": ""
    //     })
    //     let options1 = {
    //         hostname: "127.0.0.1",
    //         port: this.port,
    //         path: "/rpc/console_input",
    //         method: "POST",
    //         headers: {
    //             "Content-Type": "application/json",
    //             "Content-Length": Buffer.byteLength(postData1),
    //             "X-Shared-Secret": this.sharedSecret,
    //             "X-RStudio-Refresh-Auth-Creds": 0,
    //             "X-RS-RID": getMessageId()
    //         }
    //     }
    //     let postData2 =  JSON.stringify({
    //         "method": "get_events",
    //         "params": [5],
    //         "clientId": "33e600bb-c1b1-46bf-b562-ab5cba070b0e",
    //         "clientVersion": ""
    //     })
    //     let options2 = {
    //         hostname: "127.0.0.1",
    //         port: this.port,
    //         path: "/events/get_events",
    //         method: "POST",
    //         headers: {
    //             "Content-Type": "application/json",
    //             "Content-Length": Buffer.byteLength(postData2),
    //             "X-Shared-Secret": this.sharedSecret,
    //             "X-RStudio-Refresh-Auth-Creds": 0,
    //             "X-RS-RID": 506878359
    //         }
    //     }

    //     let processRes = res => {
    //         console.log(`STATUS: ${res.statusCode}`)
    //         console.log(`HEADERS: ${JSON.stringify(res.headers)}`)
    //         res.setEncoding('utf8')
    //         res.on('data', (chunk) => {
    //         console.log(`BODY: ${chunk}`)
    //         })
    //         res.on('end', () => {
    //         console.log('No more data in response.')
    //         })
    //     }
    //     let processErr = e => {
    //         console.error(`problem with request: ${e.message}`);
    //     }

    //     let tryIt = () => {
    //         const req0 = http.request(options0,processRes)
    //         req0.on('error', processErr);
            
    //         // Write data to request body
    //         req0.write(postData0);
    //         req0.end();

    //         const req1 = http.request(options1,processRes)
    //         req1.on('error', processErr);
            
    //         // Write data to request body
    //         req1.write(postData1);
    //         req1.end();

    //         const req2 = http.request(options2,processRes)
    //         req1.on('error', processErr);
            
    //         // Write data to request body
    //         req2.write(postData2);
    //         req2.end();
    //     }

    //     setTimeout(tryIt,3000)
    // }


