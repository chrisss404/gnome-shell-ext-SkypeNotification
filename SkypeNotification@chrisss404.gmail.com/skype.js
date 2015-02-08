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
const Shell = imports.gi.Shell;
const Tp = imports.gi.TelepathyGLib;

const Config = imports.misc.config;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Util = imports.misc.util;

const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const Scripting = imports.ui.scripting;

const SkypeConfig = Me.imports.skypeConfig.SkypeConfig;
const SkypeMenuButton = Me.imports.skypeMenuButton.SkypeMenuButton;
const SkypeSearchProvider = Me.imports.skypeSearchProvider.SkypeSearchProvider;


const SkypeIface = '<node> \
<interface name="com.Skype.API"> \
<method name="Invoke"> \
    <arg type="s" direction="in"/> \
    <arg type="s" direction="out"/> \
</method> \
</interface> \
</node>';

const SkypeIfaceClient = '<node> \
<interface name="com.Skype.API.Client"> \
<method name="Notify"> \
    <arg type="s" direction="in"/> \
</method> \
</interface> \
</node>';

const SkypeIfaceExtension = '<node> \
<interface name="com.Skype.API.Extension"> \
<method name="Notify"> \
    <arg type="s" direction="in" name="type"/> \
    <arg type="s" direction="in" name="sname"/> \
    <arg type="s" direction="in" name="sskype"/> \
    <arg type="s" direction="in" name="smessage"/> \
    <arg type="s" direction="in" name="fpath"/> \
    <arg type="s" direction="in" name="fsize"/> \
    <arg type="s" direction="in" name="fname"/> \
</method> \
</interface> \
</node>';

const SkypeProxy = Gio.DBusProxy.makeProxyWrapper(SkypeIface);

const SETTINGS_SHOW_PANEL_BUTTON_KEY = "show-top-bar-icon";
const SETTINGS_NATIVE_NOTIFICATIONS_KEY = "native-notifications";
const SETTINGS_FOLLOW_SYSTEM_WIDE_PRESENCE_KEY = "follow-system-wide-presence";
const SETTINGS_OPEN_CONTACTS_ON_LEFT_CLICK_KEY = "open-contacts-on-top-bar-icon-left-click";
const SETTINGS_IS_FIRST_RUN_KEY = "is-first-run";


const Skype = new Lang.Class({
    Name: "Skype",

    _init: function() {
        this._enabled = false;
        this._active = false;
        this._authenticated = false;
        this._currentUserHandle = "";
        this._currentPresence = "ONLINE";
        this._missedChats = "CHATS";
        this._skypeApp = null;
        this._config = null;
        this._searchProvider = null;
        this._skypeMenu = null;
        this._skypeMenuAlert = false;
        this._skypeMenuEnabled = true;
        this._skypeNativeNotifications = true;
        this._systemWidePresence = false;
        this._showContactsOnLeftClick = false;
        this._apiExtension = new SkypeAPIExtension(Lang.bind(this, this.NotifyCallback));

        this._messages = [];
        this._closeTimer = null;
        this._notificationSource = 0;
        this._activeNotification = null;

        this._proxy = new SkypeProxy(Gio.DBus.session, "com.Skype.API", "/com/Skype");
        this._dbusImpl = Gio.DBusExportedObject.wrapJSObject(SkypeIfaceClient, this);

        this._settings = null;
        this._settingsChangedSignal = null;

        this._userPresenceCallbacks = [];
        this._addUserPresenceCallback(Lang.bind(this, this._setUserPresenceMenuIcon));
    },

    _initSettings: function() {
        const GioSSS = Gio.SettingsSchemaSource;
        let schemaSource = GioSSS.new_from_directory(Me.path + "/schemas",
                GioSSS.get_default(), false);

        let schemaObj = schemaSource.lookup(Me.metadata["settings-schema"], true);
        if(!schemaObj) {
            throw new Error("Schema " + Me.metadata["settings-schema"] + " could not be found for extension " +
                            Me.uuid + ". Please check your installation.");
        }

        this._settings = new Gio.Settings({ settings_schema: schemaObj });
        this._skypeMenuEnabled = this._settings.get_boolean(SETTINGS_SHOW_PANEL_BUTTON_KEY);
        this._skypeNativeNotifications = this._settings.get_boolean(SETTINGS_NATIVE_NOTIFICATIONS_KEY);
        this._systemWidePresence = this._settings.get_boolean(SETTINGS_FOLLOW_SYSTEM_WIDE_PRESENCE_KEY);
        this._showContactsOnLeftClick = this._settings.get_boolean(SETTINGS_OPEN_CONTACTS_ON_LEFT_CLICK_KEY);
    },

    _onSettingsChanged: function() {
        this._skypeMenuEnabled = this._settings.get_boolean(SETTINGS_SHOW_PANEL_BUTTON_KEY);
        this._systemWidePresence = this._settings.get_boolean(SETTINGS_FOLLOW_SYSTEM_WIDE_PRESENCE_KEY);
        this._showContactsOnLeftClick = this._settings.get_boolean(SETTINGS_OPEN_CONTACTS_ON_LEFT_CLICK_KEY);

        let skypeNativeNotifications = this._settings.get_boolean(SETTINGS_NATIVE_NOTIFICATIONS_KEY);
        if(skypeNativeNotifications != this._skypeNativeNotifications) {
            if(this._config != null) {
                this._skypeNativeNotifications = skypeNativeNotifications;
                this._config.toggle(skypeNativeNotifications);
            } else {
                this._settings.set_boolean(SETTINGS_NATIVE_NOTIFICATIONS_KEY,
                                            this._skypeNativeNotifications);
            }
        }

        if(this._skypeMenuEnabled && this._skypeMenu == null) {
            this._skypeMenu = new SkypeMenuButton(this);
            this._runUserPresenceCallbacks();
            Main.panel.addToStatusArea("skypeMenu", this._skypeMenu);
            this._missedChat();
        }

        if(!this._skypeMenuEnabled && this._skypeMenu != null) {
            this._skypeMenu.destroy();
            this._skypeMenu = null;
        }
    },

    _authenticate: function() {
        this._proxy.InvokeRemote("NAME GnomeShellExtension", Lang.bind(this, this._onAuthenticate));
    },

    _heartBeat: function() {
        this._proxy.InvokeRemote("GET SKYPEVERSION", Lang.bind(this, this._onHeartBeat));
    },

    _missedChat: function() {
        this._proxy.InvokeRemote("SEARCH MISSEDCHATS", Lang.bind(this, this._onMissedChat));
    },

    _onAuthenticate: function(answer) {
        if(answer == "OK") {
            this._proxy.InvokeRemote("PROTOCOL 7");
        } else if(!this._authenticated && answer != "ERROR 68") {
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, Lang.bind(this, this._authenticate));
        }
    },

    _onHeartBeat: function(answer) {
        // SKYPEVERSION 171 ... Client: 4.3.0.37
        // SKYPEVERSION 171 ... Client: 4.2.0.13
        // SKYPEVERSION 171 ... Client: 4.2.0.11

        if(answer == null) {
            this._active = false;
            if(this._skypeMenu != null) {
                this._skypeMenu.destroy();
                this._skypeMenu = null;
            }

            if(this._searchProvider != null) {
                this._searchProvider.setContacts([]);
            }
        } else {
            this._active = true;
        }
        if(this._authenticated && answer == "ERROR 68") {
            this._authenticated = false;
            this._authenticate();
        }
        if(this._enabled) {
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2500, Lang.bind(this, this._heartBeat));
        }
    },

    _onMissedChat: function(answer) {
        if(this._skypeMenuAlert) {
            if(this._isSkypeChatWindowFocused()) {
                this._skypeMenuAlert = false;
                this._runUserPresenceCallbacks();
            }
        }

        if(answer != null) {
            this._missedChats = answer[0];
        }

        if(this._enabled && this._skypeMenuEnabled) {
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, Lang.bind(this, this._missedChat));
        }
    },

    enable: function() {
        if(this._enabled) {
            return;
        }
        this._enabled = true;
        this._dbusImpl.export(Gio.DBus.session, "/com/Skype/Client");

        this._skypeApp = Shell.AppSystem.get_default().lookup_app("skype.desktop");
        if(this._skypeApp == null) {
            throw new Error("Could not find Skype! Make sure that the Desktop entry file 'skype.desktop' is available.");
        }
        this._initSettings();

        if(this._config != null) {
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, Lang.bind(this, function() {
                this._config.detectOptions(this._skypeNativeNotifications);
            }));
        }
        this._authenticate();
        this._heartBeat();
        this._apiExtension.enable();
        this._settingsChangedSignal = this._settings.connect("changed",
                Lang.bind(this, this._onSettingsChanged));
    },

    disable: function() {
        this._enabled = false;
        this._dbusImpl.unexport();

        if(this._config != null) {
            this._config.detectOptions(this._skypeNativeNotifications);
        }
        if(this._skypeMenu != null) {
            this._skypeMenu.destroy();
            this._skypeMenu = null;
        }
        if(this._searchProvider != null) {
            this._searchProvider.setContacts([]);
        }
        this._apiExtension.disable();
        if(this._settingsChangedSignal != null) {
            this._settings.disconnect(this._settingsChangedSignal);
            this._settingsChangedSignal = null;
        }
    },

    updateSkypeStatus: function(presence) {
        if(this._systemWidePresence) {
            switch(presence) {
                case Tp.ConnectionPresenceType.BUSY:
                    this._proxy.InvokeRemote("SET USERSTATUS DND");
                    break;
                case Tp.ConnectionPresenceType.OFFLINE:
                    this._proxy.InvokeRemote("SET USERSTATUS OFFLINE");
                    break;
                case Tp.ConnectionPresenceType.HIDDEN:
                    this._proxy.InvokeRemote("SET USERSTATUS INVISIBLE");
                    break;
                case Tp.ConnectionPresenceType.AWAY:
                    this._proxy.InvokeRemote("SET USERSTATUS AWAY");
                    break;
                case Tp.ConnectionPresenceType.AVAILABLE:
                default:
                    this._proxy.InvokeRemote("SET USERSTATUS ONLINE");
            }
        }
    },

    _updateNotifySource: function() {
        let source = null;
        let items = Main.messageTray.getSources();

        let item = null;
        let numberOfNotifications = -1;
        for(let index in items) {
            item = items[index];
            if(item.title == "Skype") {
                if(item.count > numberOfNotifications) {
                    source = item;
                    numberOfNotifications = item.count;
                }
            }
        }

        if(source == null) {
            this._notificationSource++;
        } else {
            this._notificationSource = source;
        }
    },

    _onClose: function() {
        this._messages = [];

        if(this._activeNotification != null && !Main.messageTray._trayHovered) {
            this._activeNotification.emit("destroy", MessageTray.NotificationDestroyedReason.EXPIRED);
            this._activeNotification = null;
        }
    },

    _onClicked: function() {
        let recent = this._getRecentChats();
        if(recent.length > 0) {
            this._proxy.InvokeRemote("OPEN CHAT " + recent[0]["chat"]);
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, Lang.bind(this, this._focusSkypeChatWindow));
        }
    },

    _pushMessage: function(message) {
        if(message == null) {
            return;
        }
        this._messages.push(message);

        if(this._closeTimer != null) {
            GLib.source_remove(this._closeTimer);
            this._closeTimer = null;
        }
        this._closeTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10000, Lang.bind(this, this._onClose));
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, Lang.bind(this, this._notify));
    },

    _notify: function() {
        this._updateNotifySource();
        if(typeof this._notificationSource !== "object") {
            if(this._notificationSource < 10) {
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, Lang.bind(this, this._notify));
            } else {
                this._notificationSource = 0;
            }
            return;
        }

        let items = this._messages;
        items.reverse();

        let summary = "Skype";
        let body = [];
        let icon = "skype";

        if(this._messages.length > 1) {
            for(let index in items) {
                if(items[index].body.length > 0) {
                    body.push([items[index].summary, items[index].body].join(": "));
                } else {
                    body.push(items[index].summary);
                }
                body.push("\n");
            }
        } else {
            for(let index in items) {
                summary = items[index].summary;
                body.push(items[index].body);
                icon = items[index].icon;
            }
        }
        body = body.join("").trim();

        let params = { "gicon": Gio.icon_new_for_string(icon) };
        if(this._notificationSource.count == 0) {
            this._activeNotification = new MessageTray.Notification(this._notificationSource,
                    summary, body, params);
            this._activeNotification.setUrgency(MessageTray.Urgency.HIGH);
            this._activeNotification.connect("clicked", Lang.bind(this, this._onClicked));
            this._notificationSource.notify(this._activeNotification);
        } else {
            this._activeNotification = this._notificationSource.notifications[0];
            this._activeNotification.setTransient(true);
            this._activeNotification.setUrgency(MessageTray.Urgency.HIGH);
            this._activeNotification.connect("clicked", Lang.bind(this, this._onClicked));
            this._activeNotification.update(summary, body, params);
        }
    },

    _isShowContactsOnLeftClickActive: function() {
        return this._showContactsOnLeftClick;
    },

    _getContacts: function() {
        let results = []
        try {
            let [contacts] = this._proxy.InvokeSync("SEARCH FRIENDS");

            if(contacts.indexOf("USERS ") !== -1) {
                contacts = contacts.replace("USERS ", "").split(",");
                for(let contact in contacts) {
                    let userName = this._getUserName(contacts[contact]);
                    let item = { "handle": contacts[contact], "name": userName };
                    results.push(item);
                }
            }
        } catch(e) {
            global.log("skype._getContacts: " + e);
        }
        return results;
    },

    _getUserName: function(userHandle) {
        userHandle = userHandle.trim();

        try {
            let [displayName] = this._proxy.InvokeSync("GET USER %s DISPLAYNAME".format(userHandle));
            displayName = displayName.replace("USER %s DISPLAYNAME ".format(userHandle), "");
            if(displayName != "") {
                return displayName;
            }

            let [userName] = this._proxy.InvokeSync("GET USER %s FULLNAME".format(userHandle));
            userName = userName.replace("USER %s FULLNAME ".format(userHandle), "");
            if(userName != "") {
                return userName;
            }
        } catch(e) {
            global.log("skype._getUserName: " + e);
        }
        return userHandle;
    },

    _getRecentChats: function() {
        let chats = "";
        try {
            let [answer] = this._proxy.InvokeSync("SEARCH RECENTCHATS");
            chats = answer.replace("CHATS ", "")
            if(chats == "") {
                return [];
            }
        } catch(e) {
            global.log("skype._getRecentChats: " + e);
        }

        let results = [];
        chats = chats.split(", ");
        try {
            for(let index in chats) {
                let [topic] = this._proxy.InvokeSync("GET CHAT " + chats[index] + " TOPIC");
                topic = topic.split(" TOPIC ");

                let record = { "chat": chats[index], "title": "" };
                if(topic[1] == "") {
                    let [members] = this._proxy.InvokeSync("GET CHAT " + chats[index] + " MEMBERS");
                    members = members.split(" MEMBERS ");
                    members = members[1].split(" ");

                    let participants = [];
                    for(let item in members) {
                        if(members[item] != this._currentUserHandle) {
                            participants.push(this._getUserName(members[item]));
                        }
                    }
                    record["title"] = participants.join(", ");
                } else {
                    record["title"] = topic[1];
                }

                if(record["title"].length > 39) {
                    record["title"] = record["title"].substr(0, 39) + "...";
                }

                if(this._missedChats.indexOf(chats[index]) !== -1) {
                    record["title"] = "* " + record["title"];
                }

                results.push(record);
            }
        } catch(e) {
            global.log("skype._getRecentChats: " + e);
        }
        return results;
    },

    _getCurrentPresence: function() {
        return this._currentPresence;
    },

    _addUserPresenceCallback: function(callback) {
        if(this._userPresenceCallbacks.indexOf(callback) === -1) {
            this._userPresenceCallbacks.push(callback);
        }
    },

    _removeUserPresenceCallback: function(callback) {
        let idx = this._userPresenceCallbacks.indexOf(callback);
        if(idx !== -1) {
            this._userPresenceCallbacks.splice(idx, 1);
        }
    },

    _runUserPresenceCallbacks: function() {
        for(let i = 0; i < this._userPresenceCallbacks.length; ++i) {
            this._userPresenceCallbacks[i](this._currentPresence);
        }
    },

    _setUserPresenceMenuIcon: function() {
        if(!this._skypeMenuEnabled || this._skypeMenu == null) {
            return;
        }

        let type = "-symbolic";
        if(this._skypeMenuAlert) {
            type = "-alert-symbolic";
        }

        if(this._currentPresence == "ONLINE") {
            this._skypeMenu.setIcon("shellext-skype-presence-online" + type);
        } else if(this._currentPresence == "AWAY") {
            this._skypeMenu.setIcon("shellext-skype-presence-away" + type);
        } else if(this._currentPresence == "DND") {
            this._skypeMenu.setIcon("shellext-skype-presence-do-not-disturb" + type);
        } else if(this._currentPresence == "INVISIBLE") {
            this._skypeMenu.setIcon("shellext-skype-presence-invisible" + type);
        } else if(this._currentPresence == "OFFLINE") {
            this._skypeMenu.setIcon("shellext-skype-presence-offline" + type);
        }
    },

    NotifyCallback: function(type, params) {
        // remove the contact name from the message (Skpye 4.3.0.37)
        if(type == "ChatIncomingInitial" || type == "ChatIncoming") {
            if(params['message'].indexOf(params['contact']) === 0) {
                params['message'] = params['message'].substring(params['contact'].length + 2);
            }
        }

        if(type == "ChatIncomingInitial" || type == "ChatIncoming" || type == "CallMissed") {
            if(this._isSkypeChatWindowFocused()) {
                return;
            }
            if(!this._skypeMenuAlert) {
                this._skypeMenuAlert = true;
                this._runUserPresenceCallbacks();
            }
        }

        if(this._config != null) {
            this._pushMessage(this._config.getNotification(type, params));
        }
    },

    NotifyAsync: function(params) {
        if(!this._enabled) {
            return;
        }

        let [message] = params;
        if(message.indexOf("CURRENTUSERHANDLE ") !== -1) {
            this._authenticated = true;
            let userHandle = message.replace("CURRENTUSERHANDLE ", "");
            if(this._currentUserHandle != userHandle) {
                this._currentUserHandle = userHandle;
                if(this._currentUserHandle != "") {
                    this._config = new SkypeConfig(this, this._currentUserHandle);
                    
                    if(this._settings != null && this._settings.get_boolean(SETTINGS_IS_FIRST_RUN_KEY)) {
                        this._skypeNativeNotifications = true;
                        this._config.toggle(this._skypeNativeNotifications);

                        this._settings.set_boolean(SETTINGS_NATIVE_NOTIFICATIONS_KEY,
                                                    this._skypeNativeNotifications);
                        this._settings.set_boolean(SETTINGS_IS_FIRST_RUN_KEY, false);
                    } else {
                        this._config.detectOptions(this._skypeNativeNotifications);
                    }
                } else {
                    global.log("userHandle is not set");
                    global.log(message);
                }
            }

            if(this._skypeMenuEnabled && this._skypeMenu == null) {
                this._skypeMenu = new SkypeMenuButton(this);
                Main.panel.addToStatusArea("skypeMenu", this._skypeMenu);
                this._missedChat();
            }

            if(this._searchProvider == null) {
                this._searchProvider = new SkypeSearchProvider("SKYPE", this);
                Main.overview.addSearchProvider(this._searchProvider);
            }
            this._searchProvider.setContacts(this._getContacts());
        } else if(message.indexOf("USER ") !== -1) {
            let user = message.split(" ");
            if(user[2] == "ONLINESTATUS" && user[1] == this._currentUserHandle) {
                this._currentPresence = user[3];
                this._runUserPresenceCallbacks();
            } else if(user[2] == "BUDDYSTATUS") {
                this._searchProvider.setContacts(this._getContacts());
            }
        } else if(message.indexOf("USERSTATUS ") !== -1) {
            this._currentPresence = message.split(" ")[1];
            this._runUserPresenceCallbacks();
        }
    },

    _focusSkypeMainWindow: function() {
        let windows = this._skypeApp.get_windows();
        for(let i in windows) {
            let title = windows[i].get_title();
            if(title.indexOf(" - ") !== -1 && title.indexOf(this._currentUserHandle) !== -1) {
                Main.activateWindow(windows[i]);
                break;
            }
        }
    },

    _focusSkypeChatWindow: function() {
        let windows = this._skypeApp.get_windows();
        for(let i in windows) {
            let title = windows[i].get_title();
            if(title.indexOf(" - ") !== -1 && title.indexOf(this._currentUserHandle) === -1) {
                Main.activateWindow(windows[i]);
                break;
            }
        }
    },

    _focusSkypeAddFriendWindow: function() {
        let windows = this._skypeApp.get_windows();
        for(let i in windows) {
            let title = windows[i].get_title();
            if(title.indexOf(" - ") === -1) {
                Main.activateWindow(windows[i]);
                break;
            }
        }
    },

    _isSkypeChatWindowFocused: function() {
        let metaWindow = global.display.focus_window;
        if(metaWindow != null) {
            let title = metaWindow.get_title();
            let windows = this._skypeApp.get_windows();

            for(let i in windows) {
                if(windows[i] == metaWindow) {
                    if(title.indexOf(" - ") !== -1 && title.indexOf(this._currentUserHandle) === -1) {
                        return true;
                    }
                }
            }
        }
        return false;
    },

    _isThereAnActiveCall: function() {
        try {
            let [calls] = this._proxy.InvokeSync("SEARCH ACTIVECALLS");
            if(calls != "CALLS ") {
                return true;
            }
        } catch(e) {
            global.log("skype._isThereAnActiveCall: " + e);
        }
        return false;
    },
    
    _isSkypeRunning: function() {
        return this._active;
    },

    _quit: function(actor, event, attempts) {
        if(typeof attempts === "undefined") {
            attempts = 0;
        }

        if(this._active && attempts < 20) {
            let pids = this._skypeApp.get_pids();
            for(let i in pids) {
                Util.spawn(["kill", JSON.stringify(pids[i])]);
            }

            if(pids.length == 0) {
                if(attempts == 0 && this._skypeApp.get_state() != Shell.AppState.RUNNING) {
                    this._skypeApp.open_new_window(-1);
                }
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, Lang.bind(this, this._quit, actor, event, attempts + 1));
            }
        }
    }
});

// workaround for http://stackoverflow.com/questions/15237744/skype4py-messagestatuschanged-not-always-called
const SkypeAPIExtension = new Lang.Class({
    Name: "SkypeAPIExtension",

    _init: function(callback) {
         this._notify = callback;
         this._dbusImpl = Gio.DBusExportedObject.wrapJSObject(SkypeIfaceExtension, this);
         this._dbusId = null;
    },

    enable: function() {
         this._dbusImpl.export(Gio.DBus.session, "/com/Skype/Extension");
         this._dbusId = Gio.DBus.session.own_name('com.Skype.API.Extension',
                 Gio.BusNameOwnerFlags.ALLOW_REPLACEMENT, null, null);
    },

    disable: function() {
         this._dbusImpl.unexport();
         Gio.DBus.session.unown_name(this._dbusId);
    },

    Notify: function(type, sname, sskype, smessage, fpath, fsize, fname) {
         this._notify(type, { "contact": sname, "message": smessage,
             "filepath": fpath + "/" + fname, "filename": fname });
    }
});
