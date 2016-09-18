## GNOME Shell Skype Integration

This extension simplifies the life for Microsoft Skype users. It makes use of the [Skype API](https://github.com/chrisss404/gnome-shell-ext-SkypeNotification/raw/master/docs/Skype%20Developer%20-%20Skype%20Desktop%20API%20Reference%20Manual.pdf), which is unfortunately no longer supported, but still works with Skype version ~~4.2.0.11, 4.2.0.13, and~~[¹](http://community.skype.com/t5/Linux/Having-trouble-signing-in-Retirement-of-older-versions-of-Skype/td-p/3439685) 4.3.0.37.


#### Integrated features:

- display online presence in top bar icon
- add an indicator to the top bar icon for missed chat messages and calls
- use GNOME Shell notification style for Skype notifications
- show a list of recent chats with an activity indicator in the top bar menu
- ability to change online presence in the top bar menu
- mute microphone during calls within the top bar menu
- search provider to find Skype contacts


### Installation

There are two possibilities:

- Visit the [Skype Integration page](https://extensions.gnome.org/extension/696/skype-integration/) on extensions.gnome.org, click on the switch ("OFF" => "ON"), click on the install button.
- Or, download the source ([3.6](https://github.com/chrisss404/gnome-shell-ext-SkypeNotification/archive/3.6.zip), [3.8](https://github.com/chrisss404/gnome-shell-ext-SkypeNotification/archive/3.8.zip), [3.10](https://github.com/chrisss404/gnome-shell-ext-SkypeNotification/archive/3.10.zip), [3.12](https://github.com/chrisss404/gnome-shell-ext-SkypeNotification/archive/3.12.zip), [3.14](https://github.com/chrisss404/gnome-shell-ext-SkypeNotification/archive/3.14.zip), [3.16](https://github.com/chrisss404/gnome-shell-ext-SkypeNotification/archive/3.16.zip), copy the folder `SkypeNotification@chrisss404.gmail.com` from the downloaded archive to `~/.local/share/gnome-shell/extensions/`, restart GNOME Shell (`Alt`+`F2`, `r`, `Enter`) and enable the extension through *gnome-tweak-tool*.

#### Dependencies:
    
    D-Bus Python Bindings
        on Ubuntu: python-dbus
        on Fedora: dbus-python

----

### FAQs

#### How can I find debug/error output?

- `Alt`+`F2`, `lg`, `Enter`, navigate to `Extensions` tab and find `Show errors`
-  and / or `journalctl -xn -f /usr/bin/gnome-shell`

#### How can I enable and disable individual notifications?

Go to Options > Notifications and click on `Advanced View`. If the option `Execute the following script` is checked, the notification is enabled otherwise it is disabled ([initial question](https://github.com/chrisss404/gnome-shell-ext-SkypeNotification/issues/9)). [Here](https://github.com/chrisss404/gnome-shell-ext-SkypeNotification/blob/master/SkypeNotification%40chrisss404.gmail.com/skypeConfig.js#L45) is a list of all supported notifications.


#### Top bar menu icon shows, but I get no notifications, what can I do?

Make sure that you have installed Python D-Bus bindings. You can check by executing `python ~/.local/share/gnome-shell/extensions/SkypeNotification@chrisss404.gmail.com/notify.py -e"ChatIncoming" -n"Test" -f"%fname" -p"%fpath" -m"hello" -s"%fsize" -u"%sskype"`.


#### Can't install anymore after recent update, what shall I do?

Completely remove the extension by executing (`rm -rf ~/.local/share/gnome-shell/extensions/SkypeNotification@chrisss404.gmail.com`), restart GNOME Shell (`Alt`+`F2`, `r`, `Enter`) and reinstall it ([initial question](https://github.com/chrisss404/gnome-shell-ext-SkypeNotification/issues/17)).

----

### Known Issues

#### Group chats are missing

Most group chats are invisible, as they are not supported by the very outdated API. For more information see ([luord's comment](https://github.com/chrisss404/gnome-shell-ext-SkypeNotification/issues/69)).

----

### Screenshots

![Screenshot](https://raw.github.com/chrisss404/gnome-shell-ext-SkypeNotification/3.16/data/screenshot1.jpg)
![Screenshot](https://raw.github.com/chrisss404/gnome-shell-ext-SkypeNotification/3.16/data/screenshot2.jpg)
![Screenshot](https://raw.github.com/chrisss404/gnome-shell-ext-SkypeNotification/3.16/data/settings.png)

----

Inspired by

- https://github.com/MrTheodor/gnome-shell-ext-SkypeNotification
- https://gist.github.com/nzjrs/1006316
- https://extensions.gnome.org/extension/166/skype-contact-search/

Credits to

- https://github.com/whhglyphs/webhostinghub-glyphs/ (thanks keynslug for telling me about this awesome icons)


[1] [Retirement of older versions of Skype](http://community.skype.com/t5/Linux/Having-trouble-signing-in-Retirement-of-older-versions-of-Skype/td-p/3439685)

