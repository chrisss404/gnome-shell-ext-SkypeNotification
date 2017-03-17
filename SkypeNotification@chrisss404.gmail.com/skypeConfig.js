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

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const Me = imports.misc.extensionUtils.getCurrentExtension();

const SimpleXML = Me.imports.simpleXml.SimpleXML;

const _ = imports.gettext.domain(Me.uuid).gettext;


const SkypeConfig = new Lang.Class({
    Name: "SkypeConfig",

    _init: function(skype, currentUserHandle) {
        this._skypeApp = skype._skypeApp;
        this._isSkypeRunning = Lang.bind(skype, skype._isSkypeRunning);
        this._quitSkype = Lang.bind(skype, skype._quit);
        this._file = GLib.get_home_dir() + "/.Skype/" + currentUserHandle + "/config.xml";
        this._lastToggleState = undefined;

        let config = Gio.file_new_for_path(this._file);
        if(!config.query_exists(null)) {
            this._file = GLib.get_tmp_dir() + "/skype.xml";
        }

        this._options = {
                "CallMissed": {
                    "enabled": true, "config": ["CallMissed", "CallMissed", 1],
                    "notification": [ _("Call Missed"), "", "skype" ],
                    "sticky": true },
                "VoicemailReceived": {
                    "enabled": false, "config": ["VoicemailReceived", "VoicemailReceived", 1],
                    "notification": [ "{contact}", _("Voicemail Received"), "emblem-shared" ],
                    "sticky": true },
                "VoicemailSent": {
                    "enabled": false, "config": ["VoicemailSent", "VoicemailSent", 0],
                    "notification": [ _("Voicemail Sent"), "", "document-send" ],
                    "sticky": false },
                "ContactOnline": {
                    "enabled": false, "config": ["Online", "ContactOnline", 1],
                    "notification": [ _("{contact} has appeared online"), "", "user-available" ],
                    "sticky": false },
                "ContactOffline": {
                    "enabled": false, "config": ["Offline", "ContactOffline", 1],
                    "notification": [ _("{contact} has gone offline"), "", "user-offline" ],
                    "sticky": false },
                "ContactAuthRequest": {
                    "enabled": false, "config": ["Authreq", "ContactAuthRequest", 1],
                    "notification": [ _("Contact request from {contact}"), "", "contact-new" ],
                    "sticky": true },
                "ContactAdded": {
                    "enabled": false, "config": ["ContactAdded", "ContactAdded", 1],
                    "notification": [ _("{contact} has been added to your contact list"), "", "address-book-new" ],
                    "sticky": false },
                "ContactDeleted": {
                    "enabled": false, "config": ["ContactDeleted", "ContactDeleted", 1],
                    "notification": [ _("{contact} has been deleted from your contact list"), "", "edit-delete" ],
                    "sticky": false },
                "ChatIncomingInitial": {
                    "enabled": true, "config": ["", "", 1],
                    "notification": [ "{contact}", "{message}", "skype" ],
                    "sticky": true },
                "ChatIncoming": {
                    "enabled": false, "config": ["Chat", "ChatIncoming", 1],
                    "notification": [ "{contact}", "{message}", "skype" ],
                    "sticky": true },
                "ChatOutgoing": {
                    "enabled": false, "config": ["ChatOutgoing", "ChatOutgoing", 0],
                    "notification": [ "{contact}", "{message}", "skype" ],
                    "sticky": false },
                "ChatJoined": {
                    "enabled": false, "config": ["ChatJoined", "ChatJoined", 0],
                    "notification": [ _("{contact} joined chat"), "{message}", "system-users" ],
                    "sticky": false },
                "ChatParted": {
                    "enabled": false, "config": ["ChatParted", "ChatParted", 0],
                    "notification": [ _("{contact} left chat"), "{message}", "system-users" ],
                    "sticky": false },
                "TransferRequest": {
                    "enabled": false, "config": ["TransferRequest", "TransferRequest", 1],
                    "notification": [ _("Incoming file from {contact}"), "", "gtk-save" ],
                    "sticky": true },
                "TransferComplete": {
                	"enabled": false, "config": ["TransferComplete", "TransferComplete", 1],
                	"notification": [ _("Transfer Complete"), _("{filename} saved to {filepath}"), "gtk-save" ],
                    "sticky": false },
                "TransferFailed": {
                    "enabled": false, "config": ["TransferFailed", "TransferFailed", 1],
                    "notification": [ _("Transfer Failed"), "{filename}", "gtk-close" ],
                    "sticky": true },
                "SMSSent": {
                    "enabled": false, "config": ["SMSSent", "SMSSent", 1],
                    "notification": [ _("SMS Sent"), "", "document-send" ],
                    "sticky": false },
                "SMSFailed": {
                    "enabled": false, "config": ["SMSFailed", "SMSFailed", 1],
                    "notification": [ _("SMS Failed"), "", "gtk-close" ],
                    "sticky": true },
                "Birthday": {
                    "enabled": false, "config": ["Birthday", "Birthday", 1],
                    "notification": [ _("{contact} has a birthday tomorrow"), "", "appointment-soon" ],
                    "sticky": true },
                "OurBirthday": {
                    "enabled": false, "config": ["OurBirthday", "OurBirthday", 1],
                    "notification": [ _("Happy Birthday {contact}"), "", "emblem-favorite" ],
                    "sticky": true }
        };
    },

    getNotification: function(type, params) {
        let item = this._options[type];
        if(typeof item !== "undefined" && item.enabled) {
            let notification = { "id": params['id'], "summary": item.notification[0],
                    "body": item.notification[1], "icon": item.notification[2], "sticky": item.sticky };
            for(let token in params) {
                notification.summary = notification.summary.replace("{%s}".format(token), params[token]);
                notification.body = notification.body.replace("{%s}".format(token), params[token]);
            }
            notification.summary = this._cleanText(notification.summary);
            notification.body = this._cleanText(notification.body);
            return notification;
        }
        return null;
    },

    _cleanText: function(text) {
    	return text.replace(/&lt;/gi, "<")
                   .replace(/&gt;/gi, ">")
                   .replace(/&quot;/gi, "\"")
                   .replace(/&apos;/gi, "'")
                   .replace(/&amp;/gi, "&")
                   .replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, "");
    },

    _get: function(xml, root, name, value) {
        if(name.length == 0) {
            return {};
        }

        let element = xml.find(root, name);
        if(typeof element === "undefined") {
            element = xml.subElement(root, name);
            element.data = [value];
        }
        return element;
    },

    _set: function(params) {
        let [xml, toggle, notify, enalbe, script, ntag, stag, preset] = params;

        script = this._get(xml, script, stag, "");
        script.data = [ 'python ' + Me.path + '/notify.py -e"%type" -n"%sname" -f"%fname" -p"%fpath" -m"%smessage" -s"%fsize" -u"%sskype"' ];
        let ntagElement = this._get(xml, notify, ntag, preset);
        let stagElement = this._get(xml, enalbe, stag, preset);

        let active = (typeof ntagElement.data === "object" && parseInt(ntagElement.data) == 1 || 
                      typeof stagElement.data === "object" && parseInt(stagElement.data) == 1);
        if(toggle) {
            if(active) {
                ntagElement.data = [0];
                stagElement.data = [1];
                return true;
            } else {
                stagElement.data = [0];
                return false;
            }
        } else {
            if(active) {
                ntagElement.data = [1];
                stagElement.data = [0];
                return true;
            } else {
                ntagElement.data = [0];
                return false;
            }
        }
    },

    toggle: function(toggle) {
        if(this._lastToggleState == toggle) {
            return;
        }
        this._lastToggleState = toggle;
        let xml = this.detectOptions(toggle);

        let isRunning = this._isSkypeRunning();
        if(isRunning) {
            this._quitSkype();
        }
        this._writeXML(xml, isRunning);
    },

    detectOptions: function(state) {
        let xml = new SimpleXML();
        xml.parseFile(this._file);

        let root = xml.getRoot();
        let ui = this._get(xml, root, "UI", "");
        let notify = this._get(xml, ui, "Notify", "");
        let notifications = this._get(xml, ui, "Notifications", "");
        let notificationsEnable = this._get(xml, notifications, "Enable", "");
        let notificationsEnableScripts = this._get(xml, notificationsEnable, "Scripts", "");
        let notificationsScripts = this._get(xml, notifications, "Scripts", "");

        let params = [xml, state, notify, notificationsEnableScripts, notificationsScripts];
        for(let key in this._options) {
            this._options[key].enabled = this._set(params.concat(this._options[key].config));
        }
        this._options["CallMissed"].enabled = state;
        this._options["ChatIncomingInitial"].enabled = state;
        
        return xml;
    },
    
    _writeXML: function(xml, launchSkype) {
        if(this._isSkypeRunning()) {
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, Lang.bind(this, this._writeXML, xml, launchSkype));
        } else {
            xml.write(this._file);
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 5000, Lang.bind(this, this._launchSkype, launchSkype));
        }
    },
    
    _launchSkype: function(launchSkype) {
        if(launchSkype) {
            this._skypeApp.open_new_window(-1);
        }
    }
});
