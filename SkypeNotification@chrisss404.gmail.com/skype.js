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
const SETTINGS_DESTROY_ORIGINAL_TRAY_ICON_KEY = "destroy-original-tray-icon";
const SETTINGS_NATIVE_NOTIFICATIONS_KEY = "native-notifications";
const SETTINGS_ENABLE_SEARCH_PROVIDER_KEY = "search-provider";
const SETTINGS_FOLLOW_SYSTEM_WIDE_PRESENCE_KEY = "follow-system-wide-presence";
const SETTINGS_OPEN_CONTACTS_ON_LEFT_CLICK_KEY = "open-contacts-on-top-bar-icon-left-click";
const SETTINGS_PANEL_BUTTON_POSITION_KEY = "panel-button-position";
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
        this._skypeMostRecentNotificationContactId = "";
        this._skypeMenuEnabled = true;
        this._skypeHideOriginalTrayIcon = true;
        this._skypeNativeNotifications = true;
        this._skypeSearchProviderEnabled = true;
        this._showContactsOnLeftClick = false;
        this._skypeMenuPosition = 0;
        this._apiExtension = new SkypeAPIExtension(Lang.bind(this, this.NotifyCallback));

        this._messages = [];
        this._closeTimer = null;
        this._notificationSource = 0;
        this._recentChats = [];
        this._notificationActivity = {};
        this._notificationSectionCloseSignal = null;
        this._activeNotification = null;

        this._proxy = new SkypeProxy(Gio.DBus.session, "com.Skype.API", "/com/Skype");
        this._dbusImpl = Gio.DBusExportedObject.wrapJSObject(SkypeIfaceClient, this);

        this._settings = null;
        this._settingsChangedSignal = null;

        this._userPresenceCallbacks = [];
        this._addUserPresenceCallback(Lang.bind(this, this._setUserPresenceMenuIcon));

        this._trayIconAddedSignal = null;
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
        this._skypeHideOriginalTrayIcon = this._settings.get_boolean(SETTINGS_DESTROY_ORIGINAL_TRAY_ICON_KEY);
        this._skypeNativeNotifications = this._settings.get_boolean(SETTINGS_NATIVE_NOTIFICATIONS_KEY);
        this._skypeSearchProviderEnabled = this._settings.get_boolean(SETTINGS_ENABLE_SEARCH_PROVIDER_KEY);
        this._showContactsOnLeftClick = this._settings.get_boolean(SETTINGS_OPEN_CONTACTS_ON_LEFT_CLICK_KEY);
        this._skypeMenuPosition = this._settings.get_int(SETTINGS_PANEL_BUTTON_POSITION_KEY);
    },

    _onSettingsChanged: function() {
        this._skypeMenuEnabled = this._settings.get_boolean(SETTINGS_SHOW_PANEL_BUTTON_KEY);
        this._skypeMenuPosition = this._settings.get_int(SETTINGS_PANEL_BUTTON_POSITION_KEY);
        if(this._skypeMenuEnabled) {
            if(this._skypeMenu != null) {
                this._skypeMenu.destroy();
            }
            this._skypeMenu = new SkypeMenuButton(this);
            this._runUserPresenceCallbacks();
            this._addSkypeMenuToStatusArea("skypeMenu");
            this._missedChat();
        }

        if(!this._skypeMenuEnabled && this._skypeMenu != null) {
            this._skypeMenu.destroy();
            this._skypeMenu = null;
        }


        this._skypeHideOriginalTrayIcon = this._settings.get_boolean(SETTINGS_DESTROY_ORIGINAL_TRAY_ICON_KEY);
        if(this._skypeHideOriginalTrayIcon) {
            this._destroyOriginalTrayIcon();
        }


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
        

        this._skypeSearchProviderEnabled = this._settings.get_boolean(SETTINGS_ENABLE_SEARCH_PROVIDER_KEY);
        if(this._skypeSearchProviderEnabled) {
            if(this._searchProvider == null) {
                this._searchProvider = new SkypeSearchProvider("SKYPE", this);
                Main.overview.viewSelector._searchResults._registerProvider(this._searchProvider);
            }
            this._searchProvider.setContacts(this._getContacts());
        }

        if(!this._skypeSearchProviderEnabled && this._searchProvider != null) {
            this._searchProvider.setContacts([]);
        }

       
        this._showContactsOnLeftClick = this._settings.get_boolean(SETTINGS_OPEN_CONTACTS_ON_LEFT_CLICK_KEY);
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

        if(answer == null || answer == "") {
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

            if(this._active && this._authenticated) {
                let [answer] = this._proxy.InvokeSync("SEARCH RECENTCHATS");
                let chats = answer.replace("CHATS ", "")
                if(chats == "") {
                    this._recentChats = [];
                } else {
                    this._recentChats = chats.split(", ");
                }
            }
        }
    },

    _onMissedChat: function(answer) {
        if(this._skypeMenuAlert) {
            if(this._isSkypeChatWindowFocused()) {
                this._skypeMenuAlert = false;
                this._runUserPresenceCallbacks();
                this._messages = [];

                if(this._activeNotification != null) {
                    this._activeNotification.emit('done-displaying');
                    this._activeNotification.destroy(MessageTray.NotificationDestroyedReason.DISMISSED);
                    this._activeNotification = null;
                }
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

        let messageList = Main.panel.statusArea.dateMenu._messageList;
        if(typeof messageList === "object" && typeof messageList._notificationSection === "object" && typeof messageList._notificationSection._closeButton === "object") {
            this._notificationSectionCloseSignal = messageList._notificationSection._closeButton.connect("clicked", Lang.bind(this, this._onCloseNotificationSection));
        }

        let trayManager = Main.legacyTray._trayManager;
        if(typeof trayManager === "object") {
            this._trayIconAddedSignal = trayManager.connect('tray-icon-added',
                Lang.bind(this, this._onTrayIconAddedRemoveOriginalIcon));
            this._destroyOriginalTrayIcon();
        }
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
        if(this._notificationSectionCloseSignal != null) {
            Main.panel.statusArea.dateMenu._messageList._notificationSection._closeButton.disconnect(this._notificationSectionCloseSignal);
            this._notificationSectionCloseSignal = null;
        }
        if(this._trayIconAddedSignal != null) {
            Main.legacyTray._trayManager.disconnect(this._trayIconAddedSignal);
            this._trayIconAddedSignal = null;
        }
    },

    _onCloseNotificationSection: function() {
        this._messages = [];

        if(this._activeNotification != null) {
            this._activeNotification.emit('done-displaying');
            this._activeNotification = null;
        }

        if(this._skypeMenuAlert) {
            this._skypeMenuAlert = false;
            this._runUserPresenceCallbacks();
        }
    },

    _onClicked: function(event) {
        if(event.skype_id == 'group') {
            this._focusWindow(Lang.bind(this, this._focusSkypeChatWindow));
        } else {
            this._proxy.InvokeRemote("OPEN CHAT " + event.skype_id);
            this._focusWindow(Lang.bind(this, this._focusSkypeChatWindow));
        }

        Main.panel.closeCalendar();
    },

    _getLastChatActivity: function(uid) {
        let chat_id = "";
        let chats = this._recentChats;
        for(let index in chats) {
            if(chats[index].indexOf("#" + this._currentUserHandle + "/$" + uid + ";") !== -1) {
                chat_id = chats[index];
                break;
            }
            if(chats[index].indexOf("#" + uid + "/$" + this._currentUserHandle + ";") !== -1) {
                chat_id = chats[index];
                break;
            }
        }

        if(chat_id == "") {
            return 0;
        }

        let [timestamp] = this._proxy.InvokeSync("GET CHAT " + chat_id + " ACTIVITY_TIMESTAMP");
        return parseInt(timestamp.split("ACTIVITY_TIMESTAMP ")[1]);
    },

    _pushMessage: function(message) {
        if(message == null) {
            return;
        }

        let uid = message['id'];

        if(typeof this._notificationSource !== "object") {
            this._notificationSource = new MessageTray.Source("SkypeExtension", 'skype');
        }
        if(typeof this._notificationActivity[uid] === 'undefined') {
            this._notificationActivity[uid] = 0;
        }

        let addNotificationSource = true;
        let skypeNotificationSource = null;
        let sources = Main.messageTray.getSources();
        for(let index in sources) {
            if(sources[index].title === "Skype") {
                skypeNotificationSource = sources[index];
            } else if(sources[index].title === "SkypeExtension") {
                addNotificationSource = false;
            }
        }

        if(addNotificationSource) {
            Main.messageTray.add(this._notificationSource);
        }


        if(this._isGroupMessage(uid)) {
            uid = "group";
        }


        if(skypeNotificationSource != null && skypeNotificationSource.notifications.length > 0) {
            this._activeNotification = skypeNotificationSource.notifications[
                                                        skypeNotificationSource.notifications.length - 1];
            this._activeNotification.connect("activated", Lang.bind(this, this._onClicked));
        }
        if(this._activeNotification == null) {
            this._activeNotification = new MessageTray.Notification(this._notificationSource, "", "", {});
            this._activeNotification.connect("activated", Lang.bind(this, this._onClicked));
        }
        this._activeNotification.skype_id = uid;


        if(message['body'] == "") {
            this._messages.push("%s".format(message['summary']));
        } else {
            this._messages.push("<i>%s</i>: %s".format(message['summary'], message['body']));
        }
        while(this._messages.length > 5) {
            this._messages.splice(0, 1);
        }

        let body = "";
        for(let i in this._messages) {
            if(i != 0) {
                body = "\t\n" + body;
            }
            body = this._messages[i] + body;
        }

        message.icon = (message.icon == "skype") ? "" : message.icon;
        let params = { secondaryGIcon: Gio.icon_new_for_string(message.icon), bannerMarkup: true };
        this._activeNotification.update("Skype", body, params);
        if(skypeNotificationSource != null) {
            skypeNotificationSource.notify(this._activeNotification);
        } else {
            this._notificationSource.notify(this._activeNotification);
        }
        
        if(message['sticky']) {
            this._activeNotification._sticky = true;
        }

        if(this._activeNotification._destroyTimer != null || this._activeNotification._sticky) {
            if(this._activeNotification._destroyTimer != null) {
                GLib.source_remove(this._activeNotification._destroyTimer);
                this._activeNotification._destroyTimer = null;
            }
        }

        if(!this._activeNotification._sticky) {
            this._activeNotification._destroyTimer = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                MessageTray.NOTIFICATION_TIMEOUT * 1000,
                Lang.bind(this, function() {
                    this._activeNotification.destroy();
                    this._messages = [];
                })
            );
        }
    },
    
    _isGroupMessage: function(uid) {
        let last_activity = this._getLastChatActivity(uid);

        if(this._notificationActivity[uid] == last_activity) {
            return true;
        }

        this._notificationActivity[uid] = last_activity;
        return false;
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
        let results = [];
        let chats = this._recentChats;
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
            if(!this._isGroupMessage(params['id'])) {
                this._skypeMostRecentNotificationContactId = params['id'];
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
                this._addSkypeMenuToStatusArea("skypeMenu");
                this._missedChat();
            }

            if(this._skypeSearchProviderEnabled) {
                if(this._searchProvider == null) {
                    this._searchProvider = new SkypeSearchProvider("SKYPE", this);
                    Main.overview.viewSelector._searchResults._registerProvider(this._searchProvider);
                }
                this._searchProvider.setContacts(this._getContacts());
            }
        } else if(message.indexOf("USER ") !== -1) {
            let user = message.split(" ");
            if(user[2] == "ONLINESTATUS" && user[1] == this._currentUserHandle) {
                this._currentPresence = user[3];
                this._runUserPresenceCallbacks();
            } else if(user[2] == "BUDDYSTATUS" && this._skypeSearchProviderEnabled) {
                this._searchProvider.setContacts(this._getContacts());
            }
        } else if(message.indexOf("USERSTATUS ") !== -1) {
            this._currentPresence = message.split(" ")[1];
            this._runUserPresenceCallbacks();
        }
    },

    _addSkypeMenuToStatusArea: function(role) {
        if(this._skypeMenu == null) {
            return;
        }

        if (Main.panel.statusArea[role]) {
            throw new Error('Extension point conflict: there is already a status indicator for role ' + role);
        }

        let index = Main.panel._rightBox.get_n_children() - this._skypeMenuPosition - 1;

        Main.panel.statusArea[role] = this._skypeMenu;
        Main.panel._addToPanelBox(role, this._skypeMenu, index, Main.panel._rightBox);
    },

    _toggleSkypeMainWindow: function() {
        let closed = false;
        let windows = this._skypeApp.get_windows();
        for(let i in windows) {
            let title = windows[i].get_title();
            if(title.indexOf(" - ") !== -1 && title.indexOf(this._getCurrentUserHandle()) !== -1) {
                windows[i].delete(global.get_current_time());
                closed = true;
                break;
            }
        }

        if(!closed) {
            this._skypeApp.open_new_window(-1);
            this._focusWindow(Lang.bind(this, this._focusSkypeMainWindow));
        }
    },

    _focusWindow: function(callback, tries = 0) {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 5, Lang.bind(this, function() {
            if(tries < 200 && !callback()) {
                this._focusWindow(callback, tries + 1);
            }
        }));
    },

    _focusSkypeMainWindow: function() {
        let windows = this._skypeApp.get_windows();
        for(let i in windows) {
            let title = windows[i].get_title();
            if(title.indexOf(" - ") !== -1 && title.indexOf(this._currentUserHandle) !== -1) {
                Main.activateWindow(windows[i]);
                return true;
            }
        }
        return false;
    },

    _focusSkypeChatWindow: function() {
        let windows = this._skypeApp.get_windows();
        for(let i in windows) {
            let title = windows[i].get_title();
            if(title.indexOf(" - ") !== -1 && title.indexOf(this._currentUserHandle) === -1) {
                Main.activateWindow(windows[i]);
                return true;
            }
        }
        return false;
    },

    _focusSkypeAddFriendWindow: function() {
        let windows = this._skypeApp.get_windows();
        for(let i in windows) {
            let title = windows[i].get_title();
            if(title.indexOf(" - ") === -1) {
                Main.activateWindow(windows[i]);
                return true;
            }
        }
        return false;
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
    },

    _getCurrentUserHandle: function() {
        return this._currentUserHandle;
    },

    _destroyOriginalTrayIcon: function() {
        let tray = Main.legacyTray;
        let children = tray._iconBox.get_n_children();
        for(let i = 0; i < children; i++) {
            let button = tray._iconBox.get_child_at_index(0);
            this._onTrayIconAddedRemoveOriginalIcon(Main.legacyTray._trayManager, button.child);
        }
    },

    _onTrayIconAddedRemoveOriginalIcon: function(object, icon) {
        if(this._skypeHideOriginalTrayIcon && icon.wm_class == "Skype") {
            let button = icon.get_parent();
            if(button != null) {
                button.destroy();
            }
        }
    },
    
    _getMostRecentNotificationContactId: function() {
        if(this._skypeMenuAlert) {
            return this._skypeMostRecentNotificationContactId;
        }
        return "";
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
         this._notify(type, { "id": sskype, "contact": sname, "message": smessage,
             "filepath": fpath + "/" + fname, "filename": fname });
    }
});
