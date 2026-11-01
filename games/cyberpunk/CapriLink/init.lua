-- CapriLink: Capri (the desktop pet) asks, the game does it. Single-player only.
-- Capri writes one line to inbox.txt:  <id>|<command>|<argument>|end
-- and this answers in outbox.txt:      <id>|ok|<what happened>   or   <id>|fail|<why>

local lastId = 0
local elapsed = 0
local GOD = "CapriLink"

local function readInbox()
  local f = io.open("inbox.txt", "r")
  if not f then return nil end
  local line = f:read("*l")
  f:close()
  if not line then return nil end
  local id, cmd, arg = line:match("^(%d+)|([%w_]+)|(.*)|end$")
  if not id then return nil end
  return tonumber(id), cmd, arg
end

local function answer(id, ok, msg)
  local f = io.open("outbox.txt", "w")
  if not f then return end
  f:write(string.format("%d|%s|%s\n", id, ok and "ok" or "fail", tostring(msg or "")))
  f:close()
end

local function player()
  local p = Game.GetPlayer()
  if not p then error("no player yet: load a save first") end
  return p
end

local function give(record, count)
  local p = player()
  if not TweakDB:GetRecord(record) then error("no such item: " .. record) end
  Game.GetTransactionSystem():GiveItem(p, ItemID.FromTDBID(TweakDBID.new(record)), count)
end

local function setPool(pool, percent)
  local p = player()
  Game.GetStatPoolsSystem():RequestSettingStatPoolValue(p:GetEntityID(), pool, percent, p)
end

local AMMO = { "Ammo.HandgunAmmo", "Ammo.RifleAmmo", "Ammo.ShotgunAmmo", "Ammo.SniperRifleAmmo" }

local COMMANDS = {
  money = function(arg)
    local n = math.max(1, math.min(tonumber(arg) or 10000, 100000000))
    give("Items.money", n)
    return "added " .. n .. " eddies"
  end,
  item = function(arg)
    local name, count = arg:match("^([^,]+),?(%d*)$")
    name = name or arg
    if not name:find("%.") then name = "Items." .. name end
    give(name, tonumber(count) or 1)
    return "added " .. name
  end,
  heal = function()
    setPool(gamedataStatPoolType.Health, 100)
    return "health full"
  end,
  ram = function()
    setPool(gamedataStatPoolType.Memory, 100)
    return "RAM full"
  end,
  ammo = function(arg)
    local n = tonumber(arg) or 500
    for _, a in ipairs(AMMO) do give(a, n) end
    return "added " .. n .. " of every ammo"
  end,
  god = function(arg)
    local p = player()
    local gm = Game.GetGodModeSystem()
    if arg == "off" then
      gm:ClearGodMode(p:GetEntityID(), CName.new(GOD))
      return "god mode off"
    end
    gm:AddGodMode(p:GetEntityID(), gameGodModeType.Invulnerable, CName.new(GOD))
    return "god mode on"
  end,
  time = function(arg)
    local h = math.floor(tonumber(arg) or 12) % 24
    Game.GetTimeSystem():SetGameTimeByHMS(h, 0, 0)
    return "time set to " .. h .. ":00"
  end,
  level = function(arg)
    local n = math.max(1, math.min(tonumber(arg) or 60, 60))
    Game.SetLevel("Level", n, 1)
    return "level set to " .. n
  end,
  streetcred = function(arg)
    local n = math.max(1, math.min(tonumber(arg) or 50, 50))
    Game.SetLevel("StreetCred", n, 1)
    return "street cred set to " .. n
  end,
  perks = function(arg)
    local n = math.max(1, math.min(tonumber(arg) or 1, 100))
    Game.GiveDevPoints("Primary", n)
    return "added " .. n .. " perk points"
  end,
  attributes = function(arg)
    local n = math.max(1, math.min(tonumber(arg) or 1, 100))
    Game.GiveDevPoints("Attribute", n)
    return "added " .. n .. " attribute points"
  end,
  lua = function(arg) -- anything else CET can do, written by Capri and shown to you before it runs
    local fn, err = load(arg)
    if not fn then error(err) end
    local res = fn()
    return res ~= nil and tostring(res) or "done"
  end,
  ping = function()
    return Game.GetPlayer() and "in game" or "at the menu"
  end,
}

registerForEvent("onInit", function()
  local id = readInbox()
  lastId = id or 0 -- what was there before the game started is not run again
  answer(lastId, true, "ready")
  print("[CapriLink] ready")
end)

registerForEvent("onUpdate", function(dt)
  elapsed = elapsed + dt
  if elapsed < 0.4 then return end
  elapsed = 0
  local id, cmd, arg = readInbox()
  if not id or id <= lastId then return end
  lastId = id
  local run = COMMANDS[cmd]
  if not run then answer(id, false, "unknown command " .. cmd) return end
  local ok, res = pcall(run, arg)
  answer(id, ok, res)
  print("[CapriLink] " .. cmd .. " " .. arg .. " -> " .. tostring(res))
end)
