import * as React from "react"
import {SelectMenu, MenuItem, MenuProps} from "./SelectMenu"


export interface MenuBarProps {
    menuList: MenuProps[]
}

/** This file contains the MenuBar element for the apogee app. Embedded in it are the menu commands that run the application. 
 * activeTabName, activeTabIcon and activeTabStatus display the current tab. They are all optional. MenueData is required. */
export function MenuBar({menuList}: MenuBarProps) {

    /*let logoUrl = apogeeui.uiutil.getResourcePath("/shortlogo16.png","app")*/

    return (
        <div className="menu_bar">
            <div className="menu_bar_left">
                {/*<img src={logoUrl} className="menu_bar_icon" />*/}
                {menuList.map(menuData => <SelectMenu key={menuData.text} text={menuData.text} items={menuData.items}/>)}
            </div>
        </div>
        
    )
}