#!/usr/bin/env python3
"""Audit the generated Pulse Android manifest and network security policy."""
import sys
import xml.etree.ElementTree as ET

ANDROID = "{http://schemas.android.com/apk/res/android}"
MEDIA_SERVICE = "com.pulse.music.PulseAudioService"
MEDIA_PERMISSION = "android.permission.MEDIA_CONTENT_CONTROL"


def fail(message: str, issues: list[str]) -> None:
    issues.append(message)


def audit(manifest_path: str, network_config_path: str) -> int:
    issues: list[str] = []
    manifest = ET.parse(manifest_path).getroot()
    app = manifest.find("application")
    if app is None:
        print("[FAIL] Missing application element.")
        return 1

    if app.attrib.get(ANDROID + "usesCleartextTraffic", "").lower() != "false":
        fail("[HIGH] usesCleartextTraffic must be explicitly false.", issues)
    if app.attrib.get(ANDROID + "allowBackup", "").lower() != "false":
        fail("[HIGH] allowBackup must be explicitly false.", issues)
    if app.attrib.get(ANDROID + "networkSecurityConfig") != "@xml/network_security_config":
        fail("[HIGH] Strict network security config is not attached.", issues)

    for provider in app.findall("provider"):
        name = provider.attrib.get(ANDROID + "name", "unknown")
        exported = provider.attrib.get(ANDROID + "exported", "false").lower()
        if exported == "true":
            fail(f"[HIGH] Exported ContentProvider detected: {name}", issues)

    for receiver in app.findall("receiver"):
        name = receiver.attrib.get(ANDROID + "name", "unknown")
        exported = receiver.attrib.get(ANDROID + "exported", "false").lower()
        if exported != "false":
            fail(f"[HIGH] Internal receiver must declare exported=false: {name}", issues)

    for service in app.findall("service"):
        name = service.attrib.get(ANDROID + "name", "unknown")
        exported = service.attrib.get(ANDROID + "exported", "false").lower()
        permission = service.attrib.get(ANDROID + "permission", "")
        if name.endswith("PulseAudioService"):
            if exported != "true" or permission != MEDIA_PERMISSION:
                fail(
                    "[HIGH] MediaSessionService must be exported only with "
                    "MEDIA_CONTENT_CONTROL protection.",
                    issues,
                )
        elif exported != "false":
            fail(f"[HIGH] Internal service must declare exported=false: {name}", issues)

    permissions = {
        item.attrib.get(ANDROID + "name", "")
        for item in manifest.findall("uses-permission")
    }
    required = {
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
        "android.permission.WAKE_LOCK",
    }
    for permission in sorted(required - permissions):
        fail(f"[HIGH] Missing Media3 permission: {permission}", issues)

    network = ET.parse(network_config_path).getroot()
    base = network.find("base-config")
    if base is None or base.attrib.get("cleartextTrafficPermitted", "").lower() != "false":
        fail("[HIGH] Network base-config must deny cleartext traffic.", issues)
    else:
        anchors = base.find("trust-anchors")
        certificates = anchors.findall("certificates") if anchors is not None else []
        sources = {item.attrib.get("src", "") for item in certificates}
        if sources != {"system"}:
            fail("[HIGH] Network policy must trust system certificates only.", issues)

    if issues:
        print("Pulse Android security audit FAILED:")
        for issue in issues:
            print(" - " + issue)
        return 1
    print("PASS: Android manifest and network policy meet Pulse hardening checks.")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(
            "Usage: python3 audit-android-manifest.py "
            "<AndroidManifest.xml> <network_security_config.xml>"
        )
        sys.exit(2)
    sys.exit(audit(sys.argv[1], sys.argv[2]))
