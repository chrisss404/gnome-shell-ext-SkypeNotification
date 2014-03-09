/**
 * gnome-shell-extension-SkypeNotification
 * Skype GnomeShell Integration.
 *  
 * This file is part of gnome-shell-extension-SkypeNotification.
 *
 * gnome-shell-ext-SkypeNotification is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * gnome-shell-ext-SkypeNotification  is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with gnome-shell-ext-SkypeNotification  If not, see <http://www.gnu.org/licenses/>.
 *
 */

const Lang = imports.lang;

const GLib = imports.gi.GLib;
const St = imports.gi.St

const IconGrid = imports.ui.iconGrid;
const Main = imports.ui.main;
const Search = imports.ui.search;


const SkypeSearchProvider = new Lang.Class({
    Name: "SkypeSearchProvider",

    _init: function(title, skype) {
        this.title = title;

        this._proxy = skype._proxy;
        this._focusSkypeMainWindow = Lang.bind(skype, skype._focusSkypeMainWindow);
        this._focusSkypeChatWindow = Lang.bind(skype, skype._focusSkypeChatWindow);
        this._contacts = [];
    },

    setContacts: function(contacts) {
        this._contacts = contacts;
    },

    getResultMetas: function(result, callback) {
        let metas = [];
        for(let i in result) {
            let id = result[i];
            let name = this._contacts[id] ? this._contacts[id].name : "";
            metas.push({ "id": id,
                         "name": name,
                         "createIcon": Lang.bind(this, this._createIcon)
                       });
        }
        callback(metas);
    },

    _search: function(haystack, needles) {
        if(haystack.length == 0) {
            return;
        }

        let result = [];
        let tmp = [];

        let handle = "";
        let name = "";
        let needle = "";

        for(let index in needles) {
            needle = needles[index].toLowerCase();
            for(let i in haystack) {
                handle = haystack[i].handle.trim().toLowerCase();
                name = haystack[i].name.trim().toLowerCase();
                if(handle.indexOf(needle) === 0 || name.indexOf(needle) === 0) {
                    tmp.push(i);
                }
            }
        }
        tmp.sort(function(a, b) {
                return (haystack[a].name < haystack[b].name ? -1 : (haystack[a].name > haystack[b].name ? 1 : 0));
            });
        for(let i in tmp) {
            result = result.concat(tmp[i]);
        }

        this.searchSystem.pushResults(this, result);
    },

    filterResults: function(results, maxNumber) {
        return results.slice(0, maxNumber);
    },

    getInitialResultSet: function(terms) {
        this._search(this._contacts, terms);
    },

    getSubsearchResultSet: function(previousResults, terms) {
        this._search(this._contacts, terms);
    },

    createResultActor: function(resultMeta, terms) {
        let actor = new St.Button({ style_class: "app-well-app app-folder",
            button_mask: St.ButtonMask.ONE,
            toggle_mode: true,
            can_focus: true,
            x_fill: true,
            y_fill: true });

        let icon = new IconGrid.BaseIcon(resultMeta["name"],
                 { createIcon: Lang.bind(this, this._createIcon) });
        actor.id = resultMeta["id"];
        actor.set_child(icon.actor);
        actor.label_actor = icon.label;
        actor.connect("clicked", Lang.bind(this, this.activateResult));

        return actor;
    },

    _createIcon: function(size) {
        return new St.Icon({ icon_name: "skype",
            icon_size: size,
            style_class: "app-well-app",
            track_hover: true });
    },

    activateResult: function(event) {
        if(this._contacts[event.id]) {
            this._proxy.InvokeRemote("OPEN IM " + this._contacts[event.id].handle);
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, Lang.bind(this, this._focusSkypeChatWindow));
            Main.overview.hide();
        }
    }
});
