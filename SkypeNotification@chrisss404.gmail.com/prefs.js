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
const SETTINGS_DESTROY_ORIGINAL_TRAY_ICON_KEY = "destroy-original-tray-icon";
const SETTINGS_NATIVE_NOTIFICATIONS_KEY = "native-notifications";
const SETTINGS_ENABLE_SEARCH_PROVIDER_KEY = "search-provider";
const SETTINGS_OPEN_CONTACTS_ON_LEFT_CLICK_KEY = "open-contacts-on-top-bar-icon-left-click";
const SETTINGS_PANEL_BUTTON_POSITION_KEY = "panel-button-position";


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
    let switchMarginLeft = 24;
    
    let frame = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        border_width: 10
    });


    let showIconHbox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL
    });

    let showIconLabel = new Gtk.Label({
        xalign: 0
    });
    showIconLabel.set_markup("<span size='medium'><b>" + _("Show top bar icon") + "</b></span>");

    let showIconSwitch = new Gtk.Switch({
        active: settings.get_boolean(SETTINGS_SHOW_PANEL_BUTTON_KEY),
        margin_left: switchMarginLeft
    });
    showIconSwitch.connect("notify::active", function(element) {
        settings.set_boolean(SETTINGS_SHOW_PANEL_BUTTON_KEY, element.active);
    });

    showIconLabel.set_tooltip_text(_("Shall the top bar icon be displayed"));
    showIconSwitch.set_tooltip_text(_("Shall the top bar icon be displayed"));

    showIconHbox.pack_start(showIconSwitch, false, false, 10);
    showIconHbox.add(showIconLabel);

    frame.pack_start(showIconHbox, false, false, 10);


    let hideTrayIconHbox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL
    });

    let hideTrayIconLabel = new Gtk.Label({
        xalign: 0
    });
    hideTrayIconLabel.set_markup("<span size='medium'><b>" + _("Hide original tray icon (restart required)") + "</b></span>");

    let hideTrayIconSwitch = new Gtk.Switch({
        active: settings.get_boolean(SETTINGS_DESTROY_ORIGINAL_TRAY_ICON_KEY),
        margin_left: switchMarginLeft
    });
    hideTrayIconSwitch.connect("notify::active", function(element) {
        settings.set_boolean(SETTINGS_DESTROY_ORIGINAL_TRAY_ICON_KEY, element.active);
    });

    hideTrayIconLabel.set_tooltip_text(_("Shall the original tray icon be hidden"));
    hideTrayIconSwitch.set_tooltip_text(_("Shall the original tray icon be hidden"));

    hideTrayIconHbox.pack_start(hideTrayIconSwitch, false, false, 10);
    hideTrayIconHbox.add(hideTrayIconLabel);

    frame.pack_start(hideTrayIconHbox, false, false, 10);


    let nativeNotificationsHbox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL
    });

    let nativeNotificationsLabel = new Gtk.Label({
        xalign: 0
    });
    nativeNotificationsLabel.set_markup("<span size='medium'><b>" + _("Native notifications") + "</b></span>");

    let nativeNotificationsSwitch = new Gtk.Switch({
        active: settings.get_boolean(SETTINGS_NATIVE_NOTIFICATIONS_KEY),
        margin_left: switchMarginLeft
    });
    nativeNotificationsSwitch.connect("notify::active", function(element) {
        settings.set_boolean(SETTINGS_NATIVE_NOTIFICATIONS_KEY, element.active);
    });

    nativeNotificationsLabel.set_tooltip_text(_("Shall Skype make use of native notifications"));
    nativeNotificationsSwitch.set_tooltip_text(_("Shall Skype make use of native notifications"));

    nativeNotificationsHbox.pack_start(nativeNotificationsSwitch, false, false, 10);
    nativeNotificationsHbox.add(nativeNotificationsLabel);

    frame.pack_start(nativeNotificationsHbox, false, false, 10);


    let enableSearchProviderHbox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL
    });

    let enableSearchProviderLabel = new Gtk.Label({
        xalign: 0
    });
    enableSearchProviderLabel.set_markup("<span size='medium'><b>" + _("Search provider") + "</b></span>");

    let enableSearchProviderSwitch = new Gtk.Switch({
        active: settings.get_boolean(SETTINGS_ENABLE_SEARCH_PROVIDER_KEY),
        margin_left: switchMarginLeft
    });
    enableSearchProviderSwitch.connect("notify::active", function(element) {
        settings.set_boolean(SETTINGS_ENABLE_SEARCH_PROVIDER_KEY, element.active);
    });

    enableSearchProviderLabel.set_tooltip_text(_("Shall a Skype search provider be added"));
    enableSearchProviderSwitch.set_tooltip_text(_("Shall a Skype search provider be added"));

    enableSearchProviderHbox.pack_start(enableSearchProviderSwitch, false, false, 10);
    enableSearchProviderHbox.add(enableSearchProviderLabel);

    frame.pack_start(enableSearchProviderHbox, false, false, 10);


    let onLeftClickHbox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL
    });

    let onLeftClickLabel = new Gtk.Label({
        xalign: 0
    });
    onLeftClickLabel.set_markup("<span size='medium'><b>" + _("Open contacts on left click on top bar icon") + "</b></span>");

    let onLeftClickSwitch = new Gtk.Switch({
        active: settings.get_boolean(SETTINGS_OPEN_CONTACTS_ON_LEFT_CLICK_KEY),
        margin_left: switchMarginLeft
    });
    onLeftClickSwitch.connect("notify::active", function(element) {
        settings.set_boolean(SETTINGS_OPEN_CONTACTS_ON_LEFT_CLICK_KEY, element.active);
    });

    onLeftClickLabel.set_tooltip_text(_("Shall the Skype contact list be opened when the top bar icon is clicked by the left mouse button"));
    onLeftClickSwitch.set_tooltip_text(_("Shall the Skype contact list be opened when the top bar icon is clicked by the left mouse button"));

    onLeftClickHbox.pack_start(onLeftClickSwitch, false, false, 10);
    onLeftClickHbox.add(onLeftClickLabel);

    frame.pack_start(onLeftClickHbox, false, false, 10);


    let panelOrderHbox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL
    });

    let panelOrderLabel = new Gtk.Label({
        xalign: 0
    });
    panelOrderLabel.set_markup("<span size='medium'><b>" + _("Panel button position") + "</b></span>");

    let panelOrderSpinButton = new Gtk.SpinButton({halign:Gtk.Align.END});
    panelOrderSpinButton.set_range(-1, 20);
    panelOrderSpinButton.set_value(settings.get_int(SETTINGS_PANEL_BUTTON_POSITION_KEY));
    panelOrderSpinButton.set_increments(1, 2);
    panelOrderSpinButton.connect('value-changed', function(element) {
        settings.set_int(SETTINGS_PANEL_BUTTON_POSITION_KEY, element.get_value_as_int());
    });

    panelOrderLabel.set_tooltip_text(_("Define panel button's position"));
    panelOrderSpinButton.set_tooltip_text(_("Define panel button's position"));

    panelOrderHbox.pack_start(panelOrderSpinButton, false, false, 10);
    panelOrderHbox.add(panelOrderLabel);

    frame.pack_start(panelOrderHbox, false, false, 10);


    frame.show_all();
    return frame;
}
