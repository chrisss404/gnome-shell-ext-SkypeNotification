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

const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const St = imports.gi.St;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Util = imports.misc.util;

const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const _ = imports.gettext.domain(Me.uuid).gettext;


const SkypeMenuButton = new Lang.Class({
    Name: "SkypeMenuButton",
    Extends: PanelMenu.Button,

    _init: function(skype) {
        this.parent(0.0, "skype");
        this._isShowContactsOnLeftClickActive = Lang.bind(skype, skype._isShowContactsOnLeftClickActive);
        this._icon = new St.Icon({style_class: "system-status-icon" });

        let hbox = new St.BoxLayout({ style_class: "panel-status-menu-box" });
        hbox.add_child(this._icon);

        this.actor.add_child(hbox);
        this.actor.add_style_class_name("panel-status-button skypeIconColor");
        this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPressEvent));

        this._proxy = skype._proxy;
        this._skypeApp = skype._skypeApp;
        this._getRecentChats = Lang.bind(skype, skype._getRecentChats);
        this._focusSkypeMainWindow = Lang.bind(skype, skype._focusSkypeMainWindow);
        this._focusSkypeChatWindow = Lang.bind(skype, skype._focusSkypeChatWindow);
        this._focusSkypeAddFriendWindow = Lang.bind(skype, skype._focusSkypeAddFriendWindow);
        this._getCurrentPresence = Lang.bind(skype, skype._getCurrentPresence);
        this._isThereAnActiveCall = Lang.bind(skype, skype._isThereAnActiveCall);
        this._quitSkype = Lang.bind(skype, skype._quit);

        this._recentChatsSection = new PopupMenu.PopupSubMenuMenuItem(_("Recent Chats"));

        let changeStatusSection = new PopupMenu.PopupSubMenuMenuItem(_("Change Status"));
        changeStatusSection.connect("open-state-changed", Lang.bind(this, this._updateStatusDots));

        let changeStatusOnline = new PopupMenu.PopupMenuItem(_("Online"));
        changeStatusOnline.connect("activate", Lang.bind(this, this._changeStatusOnline));
        changeStatusSection.menu.addMenuItem(changeStatusOnline);

        let changeStatusAway = new PopupMenu.PopupMenuItem(_("Away"));
        changeStatusAway.connect("activate", Lang.bind(this, this._changeStatusAway));
        changeStatusSection.menu.addMenuItem(changeStatusAway);

        let changeStatusDnd = new PopupMenu.PopupMenuItem(_("Do Not Disturb"));
        changeStatusDnd.connect("activate", Lang.bind(this, this._changeStatusDnd));
        changeStatusSection.menu.addMenuItem(changeStatusDnd);

        let changeStatusInvisible = new PopupMenu.PopupMenuItem(_("Invisible"));
        changeStatusInvisible.connect("activate", Lang.bind(this, this._changeStatusInvisible));
        changeStatusSection.menu.addMenuItem(changeStatusInvisible);

        let changeStatusOffline = new PopupMenu.PopupMenuItem(_("Offline"));
        changeStatusOffline.connect("activate", Lang.bind(this, this._changeStatusOffline));
        changeStatusSection.menu.addMenuItem(changeStatusOffline);

        this._statusMenuItems = {
            'ONLINE': changeStatusOnline,
            'AWAY': changeStatusAway,
            'DND': changeStatusDnd,
            'INVISIBLE': changeStatusInvisible,
            'OFFLINE': changeStatusOffline
        };

        skype._addUserPresenceCallback(Lang.bind(this, this._updateStatusDots));

        let showContactList = new PopupMenu.PopupMenuItem(_("Show Contact List"));
        showContactList.connect("activate", Lang.bind(this, this._openContactList));

        let addContact = new PopupMenu.PopupMenuItem(_("Add a Contact"));
        addContact.connect("activate", Lang.bind(this, this._openAddContact));

        this._muteSwitch = new PopupMenu.PopupSwitchMenuItem(_("Microphone"));
        this._muteSwitch.connect("toggled", Lang.bind(this, this._toggleMute));

        let quit = new PopupMenu.PopupMenuItem(_("Quit"));
        quit.connect("activate", Lang.bind(this, this._quitSkype, 0));

        this.menu.addMenuItem(this._recentChatsSection);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(changeStatusSection);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(showContactList);
        this.menu.addMenuItem(addContact);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(this._muteSwitch);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(quit);

        this.menu.connect("open-state-changed", Lang.bind(this, this._updateRecentChats));
        this.menu.connect("open-state-changed", Lang.bind(this, this._updateMuteSwitch));
        this.menu.connect("open-state-changed", Lang.bind(this, this._updateStatusDots));
    },

    setIcon: function(icon) {
        this._icon.icon_name = icon;
    },

    _onButtonPressEvent: function(actor, event) {
        if(this._isShowContactsOnLeftClickActive() && event.get_button() == 1) {
            this.menu.close();
            this._openContactList();
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    },

    _updateRecentChats: function(event) {
        if(event.isOpen) {
            this._recentChatsSection.menu.removeAll();

            let chats = this._getRecentChats();
            for(let index in chats) {
                let chatItem = new PopupMenu.PopupMenuItem(chats[index].title);
                chatItem.chatId = chats[index].chat;
                chatItem.connect("activate", Lang.bind(this, this._openChat));
                this._recentChatsSection.menu.addMenuItem(chatItem);
            }
        }
    },

    _updateStatusDots: function() {
        let curStatus = this._getCurrentPresence();
        for(let status in this._statusMenuItems) {
            let checked = status === curStatus;
            let menuItem = this._statusMenuItems[status];

            menuItem.setShowDot(checked);
        }
    },

    _openChat: function(actor) {
        if(this._proxy != null) {
            this._proxy.InvokeRemote("OPEN CHAT " + actor.chatId);
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, Lang.bind(this, this._focusSkypeChatWindow));
        }
    },

    _changeStatusOnline: function() {
        if(this._proxy != null) {
            this._proxy.InvokeRemote("SET USERSTATUS ONLINE");
        }
    },

    _changeStatusAway: function() {
        if(this._proxy != null) {
            this._proxy.InvokeRemote("SET USERSTATUS NA");
        }
    },

    _changeStatusDnd: function() {
        if(this._proxy != null) {
            this._proxy.InvokeRemote("SET USERSTATUS DND");
        }
    },

    _changeStatusInvisible: function() {
        if(this._proxy != null) {
            this._proxy.InvokeRemote("SET USERSTATUS INVISIBLE");
        }
    },

    _changeStatusOffline: function() {
        if(this._proxy != null) {
            this._proxy.InvokeRemote("SET USERSTATUS OFFLINE");
        }
    },

    _openContactList: function() {
        this._skypeApp.open_new_window(-1);
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, Lang.bind(this, this._focusSkypeMainWindow));
    },

    _openAddContact: function() {
        if(this._proxy != null) {
            this._proxy.InvokeRemote("OPEN ADDAFRIEND");
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, Lang.bind(this, this._focusSkypeAddFriendWindow));
        }
    },

    _getMute: function() {
        let result = this._proxy.InvokeSync("GET MUTE").toString();
        return result.indexOf("ON") == -1;
    },

    _setMute: function(value) {
        this._proxy.InvokeSync("SET MUTE " + value);
    },

    _updateMuteSwitch: function(actor) {
        if(actor.isOpen) {
            this._muteSwitch.setToggleState(this._getMute());
        }
        this._muteSwitch.setSensitive(this._isThereAnActiveCall());
    },

    _toggleMute: function(actor) {
        this._setMute(actor.state ? "OFF" : "ON");
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, Lang.bind(this, this._updateMuteSwitch, this.menu));
    }
});
