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

const Gio = imports.gi.Gio;
const Lang = imports.lang;

var SimpleXML = new Lang.Class({
    Name: "SimpleXML",

    _init: function() {
        this._clear();
    },

    _clear: function() {
        this._doc = { "name": "root", "data": [] };
        this._tokens = [];
        this._pointer = 0;
        this._depth = 0;
        this._level = [ this._doc ];
    },

    parseFile: function(path) {
        let file = Gio.file_new_for_path(path);
        let contents = "";
        if(file.query_exists(null)) {
            contents = file.load_contents(null);
            contents = contents[1].toString();
        }

        this.parseString(contents);
    },

    parseString: function(string) {
        this._clear();

        let tokens = string.split(/([<+>])/);
        this._tokens = [];
        for(let index = 0, amount = tokens.length; index < amount; index++) {
            if(tokens[index] == "<") {
                this._tokens.push(tokens[index++] + tokens[index++]);
            } else {
                this._tokens.push(tokens[index]);
            }
        }
        this._tokens.reverse();

        this._createTree();
    },

    getRoot: function() {
        return this._doc.data[0];
    },

    find: function(root, name) {
        if(typeof root === "undefined") {
            return undefined;
        }
        for(let index in root.data) {
            if(typeof root.data[index] === "object" && root.data[index].name == name) {
                return root.data[index]; 
            }
        }
        return undefined;
    },

    subElement: function(root, name) {
        let element = { "name": name, "data": [], "attr": [] };
        if(typeof root === "undefined") {
            this._doc.data.push(element);
        } else {
            root.data.push(element);
        }
        return element;
    },

    write: function(path) {
        let contents = '<?xml version="1.0"?>\n';

        for(let index in this._doc.data) {
            contents += this._stringify(this._doc.data[index]);
        }

        let file = Gio.file_new_for_path(path);
        file.replace_contents(contents, "", true, Gio.FileCreateFlags.NONE, null, null);
    },

    _stringify: function(obj) {
        obj.data.reverse();

        let text = "<" + obj.name;
        for(let item in obj.attr) {
            text += " " + obj.attr[item];
        }
        text += ">";

        for(let item in obj.data) {
            if(typeof obj.data[item] === "object") {
                text += this._stringify(obj.data[item]);
            } else {
                text += obj.data[item];
            }
        }
        return text + "</" + obj.name + ">\n";
    },

    _getNextToken: function() {
        if(this._pointer + 1 < this._tokens.length) {
            return this._tokens[this._pointer++].trim().split(" ");
        }
        return null;
    },

    _createTree: function() {
        let token;
        while((token = this._getNextToken()) != null) {
            if(token[0] != "") {
                if(token[0].indexOf("</") === 0) {
                    this._level[this._depth + 1] = this.subElement(this._level[this._depth], token[0].substr(2));
                    this._depth++;
                } else if(token[0].substr(1) == this._level[this._depth].name) {
                    token.splice(0, 1);
                    this._level[this._depth].attr = token;
                    this._depth--;
                } else if(token[0] == "<?xml") {
                } else {
                    let contents = "";
                    for(let item in token) {
                        contents += token[item] + " ";
                    }
                    this._level[this._depth].data = [contents.trim()]; 
                }
            }
        }
    }
});
