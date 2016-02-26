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
const Gtk = imports.gi.Gtk;

const Me = imports.misc.extensionUtils.getCurrentExtension();

const _ = imports.gettext.domain(Me.uuid).gettext;

const SETTINGS_SHOW_PANEL_BUTTON_KEY = "show-top-bar-icon";
const SETTINGS_NATIVE_NOTIFICATIONS_KEY = "native-notifications";
const SETTINGS_ENABLE_SEARCH_PROVIDER_KEY = "search-provider";
const SETTINGS_FOLLOW_SYSTEM_WIDE_PRESENCE_KEY = "follow-system-wide-presence";
const SETTINGS_OPEN_CONTACTS_ON_LEFT_CLICK_KEY = "open-contacts-on-top-bar-icon-left-click";


let settings;
function init() {
    imports.gettext.bindtextdomain(Me.uuid, Me.path + "/locale");
    const GioSSS = Gio.SettingsSchemaSource;

    let schemaSource = GioSSS.new_from_directory(Me.path + "/schemas", 
            GioSSS.get_default(), false);

    let schemaObj = schemaSource.lookup(Me.metadata["settings-schema"], true);
    if(!schemaObj) {
        throw new Error("Schema " + Me.metadata["settings-schema"] + " could not be found for extension " +
                        Me.uuid + ". Please check your installation.");
    }

    settings = new Gio.Settings({ settings_schema: schemaObj });
}

function buildPrefsWidget() {
    let frame = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        border_width: 10
    });


    let hbox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL
    });

    let showIconLabel = new Gtk.Label({
        xalign: 0
    });
    showIconLabel.set_markup("<span size='medium'><b>" + _("Show top bar icon") + "</b></span>");

    let showIconSwitch = new Gtk.Switch({
        active: settings.get_boolean(SETTINGS_SHOW_PANEL_BUTTON_KEY)
    });
    showIconSwitch.connect("notify::active", function(button) {
        settings.set_boolean(SETTINGS_SHOW_PANEL_BUTTON_KEY, button.active);
    });

    showIconLabel.set_tooltip_text(_("Shall the top bar icon be displayed"));
    showIconSwitch.set_tooltip_text(_("Shall the top bar icon be displayed"));

    hbox.pack_start(showIconSwitch, false, false, 10);
    hbox.add(showIconLabel);

    frame.pack_start(hbox, false, false, 10);


    let hbox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL
    });

    let nativeNotificationsLabel = new Gtk.Label({
        xalign: 0
    });
    nativeNotificationsLabel.set_markup("<span size='medium'><b>" + _("Native notifications") + "</b></span>");

    let nativeNotificationsSwitch = new Gtk.Switch({
        active: settings.get_boolean(SETTINGS_NATIVE_NOTIFICATIONS_KEY)
    });
    nativeNotificationsSwitch.connect("notify::active", function(button) {
        settings.set_boolean(SETTINGS_NATIVE_NOTIFICATIONS_KEY, button.active);
    });

    nativeNotificationsLabel.set_tooltip_text(_("Shall Skype make use of native notifications"));
    nativeNotificationsSwitch.set_tooltip_text(_("Shall Skype make use of native notifications"));

    hbox.pack_start(nativeNotificationsSwitch, false, false, 10);
    hbox.add(nativeNotificationsLabel);

    frame.pack_start(hbox, false, false, 10);


    let hbox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL
    });

    let enableSearchProviderLabel = new Gtk.Label({
        xalign: 0
    });
    enableSearchProviderLabel.set_markup("<span size='medium'><b>" + _("Search provider") + "</b></span>");

    let enableSearchProviderSwitch = new Gtk.Switch({
        active: settings.get_boolean(SETTINGS_ENABLE_SEARCH_PROVIDER_KEY)
    });
    enableSearchProviderSwitch.connect("notify::active", function(button) {
        settings.set_boolean(SETTINGS_ENABLE_SEARCH_PROVIDER_KEY, button.active);
    });

    enableSearchProviderLabel.set_tooltip_text(_("Shall a Skype search provider be added"));
    enableSearchProviderSwitch.set_tooltip_text(_("Shall a Skype search provider be added"));

    hbox.pack_start(enableSearchProviderSwitch, false, false, 10);
    hbox.add(enableSearchProviderLabel);

    frame.pack_start(hbox, false, false, 10);


    let hbox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL
    });

    let followSystemPresenceLabel = new Gtk.Label({
        xalign: 0
    });
    followSystemPresenceLabel.set_markup("<span size='medium'><b>" + _("Follow system-wide presence state") + "</b></span>");

    let followSystemPresenceSwitch = new Gtk.Switch({
        active: settings.get_boolean(SETTINGS_FOLLOW_SYSTEM_WIDE_PRESENCE_KEY)
    });
    followSystemPresenceSwitch.connect("notify::active", function(button) {
        settings.set_boolean(SETTINGS_FOLLOW_SYSTEM_WIDE_PRESENCE_KEY, button.active);
    });

    followSystemPresenceLabel.set_tooltip_text(_("Shall Skype online status follow the system-wide presence state"));
    followSystemPresenceSwitch.set_tooltip_text(_("Shall Skype online status follow the system-wide presence state"));

    hbox.pack_start(followSystemPresenceSwitch, false, false, 10);
    hbox.add(followSystemPresenceLabel);

    frame.pack_start(hbox, false, false, 10);


    let hbox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL
    });

    let onLeftClickLabel = new Gtk.Label({
        xalign: 0
    });
    onLeftClickLabel.set_markup("<span size='medium'><b>" + _("Open contacts on left click on top bar icon") + "</b></span>");

    let onLeftClickSwitch = new Gtk.Switch({
        active: settings.get_boolean(SETTINGS_OPEN_CONTACTS_ON_LEFT_CLICK_KEY)
    });
    onLeftClickSwitch.connect("notify::active", function(button) {
        settings.set_boolean(SETTINGS_OPEN_CONTACTS_ON_LEFT_CLICK_KEY, button.active);
    });

    onLeftClickLabel.set_tooltip_text(_("Shall the Skype contact list be opened when the top bar icon is clicked by the left mouse button"));
    onLeftClickSwitch.set_tooltip_text(_("Shall the Skype contact list be opened when the top bar icon is clicked by the left mouse button"));

    hbox.pack_start(onLeftClickSwitch, false, false, 10);
    hbox.add(onLeftClickLabel);

    frame.pack_start(hbox, false, false, 10);


    frame.show_all();
    return frame;
}
