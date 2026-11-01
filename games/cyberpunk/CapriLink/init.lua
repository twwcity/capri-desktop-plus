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
  return tonumber(id), cmd, (arg:gsub("\30", "\n")) -- Capri sends new lines as \30 to keep one line
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

-- every item the game has, by its in-game name and its ID, built the first time a name is asked for
local index
local ITEM_TYPES = { "gamedataWeaponItem_Record", "gamedataClothing_Record", "gamedataItem_Record" }

local function buildIndex()
  index = {}
  local seen = {}
  for _, kind in ipairs(ITEM_TYPES) do
    for _, rec in ipairs(TweakDB:GetRecords(kind) or {}) do
      local ok, id = pcall(function() return TDBID.ToStringDEBUG(rec:GetID()) end)
      if ok and id and not seen[id] and not id:find("[Rr]ecipe") and not id:find("[Cc]rafting") then
        seen[id] = true
        local okName, name = pcall(function() return Game.GetLocalizedTextByKey(rec:DisplayName()) end)
        local okTag, iconic = pcall(function() return rec:TagsContains(CName.new("IconicWeapon")) end)
        index[#index + 1] = { id = id, name = (okName and name or ""):lower(), key = id:lower():gsub("[_%.]", " "),
          iconic = okTag and iconic or false }
      end
    end
  end
end

local function words(s)
  local out = {}
  for w in s:lower():gsub("[_%.,%-]", " "):gmatch("%S+") do
    if w ~= "items" and w ~= "preset" then out[#out + 1] = w end
  end
  return out
end

local function hits(hay, list)
  local n = 0
  for _, w in ipairs(list) do if #w > 2 and hay:find(w, 1, true) then n = n + 1 end end
  return n
end

-- best item for a name and/or a guessed ID ("Guts Items.Preset_Carnage_Rebecca"): an exact in-game name
-- wins, then the item whose name or ID holds the most of the words. In-game names are in the game's
-- language, so the ID words matter. Iconic weapons and Preset IDs win ties, shorter IDs after that.
local function findItem(query, exact)
  if not index then buildIndex() end
  local list = words(query)
  local q = (exact or ""):lower():gsub("^%s+", ""):gsub("%s+$", "")
  local best, bestScore
  for _, it in ipairs(index) do
    local score = 0
    if q ~= "" and it.name == q then score = 1000 end
    score = score + 40 * math.max(hits(it.name, list), hits(it.key, list))
    if score > 0 then
      if it.iconic then score = score + 15 end
      if it.id:find("Preset") then score = score + 10 end
      if it.id:find("Default") then score = score - 5 end
      score = score - #it.id / 100
      if not bestScore or score > bestScore then best, bestScore = it, score end
    end
  end
  return best and best.id
end

-- level, street cred and points live in the player's development data (patch 2.x)
local function dev()
  local p = player()
  return Game.GetScriptableSystemsContainer():Get(CName.new("PlayerDevelopmentSystem")):GetDevelopmentData(p)
end

-- in-game names: some come as "LocKey#123", the rest are text already
local function locName(s)
  s = tostring(s or "")
  if s:find("^LocKey#") then
    local ok, t = pcall(function() return Game.GetLocalizedText(s) end)
    if ok and t and t ~= "" then return t end
  end
  return s
end

-- --- cars: every car and bike V can own, unlocked and called over ---
local function carList()
  local out = {}
  for _, r in ipairs(TweakDB:GetRecords("gamedataVehicle_Record") or {}) do
    local id = TDBID.ToStringDEBUG(r:GetID())
    if id and id:find("_player$") then
      local ok, name = pcall(function() return Game.GetLocalizedTextByKey(r:DisplayName()) end)
      out[#out + 1] = { id = id, name = ok and name or "" }
    end
  end
  return out
end

-- --- places: what's on the map (fast travel, shops, ripperdocs, quests, your waypoint) with positions ---
local places = {}
local function placeList()
  places = {}
  local p = player()
  for _, m in ipairs(Game.GetMappinSystem():GetMappins(gamemappinsMappinTargetType.Map) or {}) do
    local okV, v = pcall(function() return tostring(m:GetVariant()):match(": (%w+)") or "" end)
    local kind = (okV and v or ""):gsub("Variant$", ""):gsub("^ServicePoint", "")
    local tracked = m:IsPlayerTracked()
    if tracked or kind == "CustomPosition" or not kind:find("^Zzz") then
      local okN, name = pcall(function() return locName(m:GetDisplayName()) end)
      places[#places + 1] = { pos = m:GetWorldPosition(), name = okN and name or "", kind = kind,
        tracked = tracked, dist = m:GetDistanceToPlayer() }
    end
  end
  table.sort(places, function(a, b) return a.dist < b.dist end)
  return places
end

local function placeAt(arg)
  arg = tostring(arg or ""):lower()
  if #places == 0 then placeList() end
  if arg == "waypoint" or arg == "marker" or arg == "" then
    placeList()
    for _, pl in ipairs(places) do if pl.kind == "CustomPosition" then return pl end end
    for _, pl in ipairs(places) do if pl.tracked then return pl end end
    error("put a waypoint on the map first")
  end
  local x, y, z = arg:match("^(%-?[%d.]+),(%-?[%d.]+),(%-?[%d.]+)$")
  if x then return { pos = Vector4.new(tonumber(x), tonumber(y), tonumber(z), 1), name = arg } end
  local pl = places[tonumber(arg) or -1]
  if not pl then error("no such place: " .. arg) end
  return pl
end

local driving -- { car, cmd } while she drives

-- --- people around: the one you look at, the hostile ones, or everyone near ---
local function people(which, radius)
  local p = player()
  local look = which == "look" or which == "" or not which
  if look then
    local t = Game.GetTargetingSystem():GetLookAtObject(p, false, false)
    if t and t:IsNPC() and not t:IsDead() then return { t } end
  end
  local q = TargetSearchQuery.new()
  q.maxDistance = look and 60 or radius
  q.testedSet = TargetingSet.Complete
  q.searchFilter = TSF_NPC()
  q.ignoreInstigator = true
  local _, parts = Game.GetTargetingSystem():GetTargetParts(p, q)
  local out, seen, around = {}, {}, 0
  -- "look": the person nearest the middle of your screen (within ~8 degrees)
  local pos = p:GetWorldPosition()
  local from = { x = pos.x, y = pos.y, z = pos.z + 1.6 } -- eye height
  local ahead = p:GetWorldForward()
  pcall(function() ahead = Game.GetCameraSystem():GetActiveCameraForward() end)
  local best, bestDot = nil, math.cos(math.rad(8))
  for _, part in ipairs(parts or {}) do
    local e = part:GetComponent():GetEntity()
    local key = e and tostring(e:GetEntityID().hash)
    if e and not seen[key] and e:IsNPC() and not e:IsDead() then
      seen[key] = true
      around = around + 1
      if look then
        local at = e:GetWorldPosition()
        local dx, dy, dz = at.x - from.x, at.y - from.y, at.z + 1.4 - from.z
        local len = math.sqrt(dx * dx + dy * dy + dz * dz)
        local dot = len > 0 and (dx * ahead.x + dy * ahead.y + dz * ahead.z) / len or -1
        if dot > bestDot then best, bestDot = e, dot end
      else
        local hostile = false
        pcall(function() hostile = e:GetAttitudeTowards(p) == EAIAttitude.AIA_Hostile end)
        if which == "all" or hostile then out[#out + 1] = e end
      end
    end
  end
  if look then
    if best then return { best } end
    error("aim at someone first (nobody in your sights)")
  end
  if #out == 0 then
    error(which == "all" and "nobody around" or ("no enemies around: the " .. around .. " people near you are not hostile. Say everyone to hit them too"))
  end
  return out
end

-- what each hack does: status effects from the game itself (Blackwall ones are from Phantom Liberty)
local HACKS = {
  blackwall = { "BaseStatusEffect.BlackwallHackBrainVFX", "BaseStatusEffect.HauntedBlackwallForceKill" },
  kill = { "BaseStatusEffect.HauntedBlackwallForceKill" },
  suicide = { "BaseStatusEffect.SuicideWithWeapon" },
  collapse = { "BaseStatusEffect.SystemCollapse" },
  burn = { "BaseStatusEffect.Burning" },
  shock = { "BaseStatusEffect.Electrocuted" },
  blind = { "BaseStatusEffect.Blind" },
  madness = { "BaseStatusEffect.Madness" },
  stun = { "BaseStatusEffect.Stun" },
  poison = { "BaseStatusEffect.ContagionPoison" },
  overheat = { "BaseStatusEffect.Overheat" },
  ping = { "BaseStatusEffect.Ping" },
}

-- --- flying: V is held up in the air every frame; walk keys steer, "go" glides where you look ---
local fly -- { z, rise (m/s), speed (m/s forward along your view), landing = seconds left of safety }
local FLY_GOD = "CapriFly"

local function flySafe(on)
  local p = Game.GetPlayer()
  if not p then return end
  local gm = Game.GetGodModeSystem()
  if on then gm:AddGodMode(p:GetEntityID(), gameGodModeType.Invulnerable, CName.new(FLY_GOD))
  else gm:ClearGodMode(p:GetEntityID(), CName.new(FLY_GOD)) end
end

local landingLeft = 0
local function flyTick(dt)
  if landingLeft > 0 then
    landingLeft = landingLeft - dt
    if landingLeft <= 0 then flySafe(false) end
  end
  if not fly then return end
  local p = Game.GetPlayer()
  if not p or p:GetMountedVehicle() then fly = nil return end
  local pos = p:GetWorldPosition()
  local x, y = pos.x, pos.y
  fly.z = fly.z + fly.rise * dt
  if fly.speed > 0 then
    local f = Game.GetCameraSystem():GetActiveCameraForward()
    x, y = x + f.x * fly.speed * dt, y + f.y * fly.speed * dt
    fly.z = fly.z + f.z * fly.speed * dt
  end
  Game.GetTeleportationFacility():Teleport(p, Vector4.new(x, y, fly.z, 1), p:GetWorldOrientation():ToEulerAngles())
end

local function flyStart(up)
  local p = player()
  if p:GetMountedVehicle() then error("get out of the car first") end
  local pos = p:GetWorldPosition()
  fly = fly or { z = pos.z, rise = 0, speed = 0 }
  fly.z = fly.z + (up or 0)
  flySafe(true)
  landingLeft = 0
end

local function flyStop()
  fly = nil
  landingLeft = 8 -- still unhurtable while falling to the ground
end

-- keys you can set in CET > Bindings (CapriLink): hold to rise / sink / glide, or toggle flying
registerInput("capri_fly_up", "Fly: rise (hold)", function(down)
  if down then pcall(flyStart, 0) end
  if fly then fly.rise = down and 8 or 0 end
end)
registerInput("capri_fly_down", "Fly: sink (hold)", function(down)
  if fly then fly.rise = down and -8 or 0 end
end)
registerInput("capri_fly_go", "Fly: glide where you look (hold)", function(down)
  if down then pcall(flyStart, 0) end
  if fly then fly.speed = down and 25 or 0 end
end)
registerHotkey("capri_fly_toggle", "Fly: on / off", function()
  if fly then flyStop() else pcall(flyStart, 3) end
end)

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
  -- "Items.X", "Items.X,2", or "Items.X,1,Guts" (the in-game name, used when the ID isn't real)
  item = function(arg)
    local id, count, name = arg:match("^([^,]*),?(%d*),?(.*)$")
    id = id or arg
    local n = tonumber(count) or 1
    local record = id
    if record ~= "" and not record:find("%.") then record = "Items." .. record end
    if record == "" or not TweakDB:GetRecord(record) then
      record = findItem(name .. " " .. id, name)
      if not record then error("no item called " .. (name ~= "" and name or id)) end
    end
    give(record, n)
    return "added " .. record
  end,
  -- the real items closest to some words, for Capri's AI to pick from: "id=in-game name" separated by ";"
  search = function(arg)
    if not index then buildIndex() end
    local list = words(arg)
    local found = {}
    for _, it in ipairs(index) do
      local n = math.max(hits(it.name, list), hits(it.key, list))
      if n > 0 and not it.id:find("^TEST") then
        found[#found + 1] = { it = it, n = n * 10 + (it.iconic and 3 or 0) + (it.id:find("Preset") and 1 or 0) }
      end
    end
    table.sort(found, function(a, b) return a.n > b.n end)
    local out = {}
    for i = 1, math.min(25, #found) do
      local it = found[i].it
      out[i] = it.id .. "=" .. it.name .. (it.iconic and " (iconic)" or "")
    end
    return table.concat(out, ";")
  end,
  find = function(arg)
    local id = findItem(arg, arg)
    if not id then error("no item called " .. arg) end
    return id
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
    dev():SetLevel(gamedataProficiencyType.Level, n, telemetryLevelGainReason.Gameplay)
    return "level set to " .. n
  end,
  streetcred = function(arg)
    local n = math.max(1, math.min(tonumber(arg) or 50, 50))
    dev():SetLevel(gamedataProficiencyType.StreetCred, n, telemetryLevelGainReason.Gameplay)
    return "street cred set to " .. n
  end,
  perks = function(arg)
    local n = math.max(1, math.min(tonumber(arg) or 1, 100))
    local d = dev()
    d:AddDevelopmentPoints(n, gamedataDevelopmentPointType.Primary)
    return "added " .. n .. " perk points (now " .. d:GetDevPoints(gamedataDevelopmentPointType.Primary) .. ")"
  end,
  attributes = function(arg)
    local n = math.max(1, math.min(tonumber(arg) or 1, 100))
    local d = dev()
    d:AddDevelopmentPoints(n, gamedataDevelopmentPointType.Attribute)
    return "added " .. n .. " attribute points (now " .. d:GetDevPoints(gamedataDevelopmentPointType.Attribute) .. ")"
  end,
  -- every locked cyberware slot: the ones behind a perk get that perk, the ones behind a quest fact get it
  cyberslots = function()
    local p = player()
    local d = dev()
    local q = Game.GetQuestsSystem()
    local done = {}
    for _, area in ipairs({ "SystemReplacementCW", "FrontalCortexCW", "OcularCW", "EyesCW", "ArmsCW", "HandsCW",
        "MusculoskeletalSystemCW", "NervousSystemCW", "IntegumentarySystemCW", "CardiovascularSystemCW", "LegsCW", "ImmuneSystemCW" }) do
      for _, slot in ipairs(TweakDB:GetFlat("EquipmentArea." .. area .. ".equipSlots") or {}) do
        local pre = TweakDB:GetFlat(TDBID.ToStringDEBUG(slot) .. ".unlockPrereqRecord")
        local rec = pre and TweakDB:GetRecord(pre)
        if rec then
          local okPerk, perk = pcall(function() return rec:PerkType() end)
          local okFact, fact = pcall(function() return TweakDB:GetFlat(TDBID.ToStringDEBUG(pre) .. ".fact") end)
          if okPerk and perk then
            local level = TweakDB:GetFlat(TDBID.ToStringDEBUG(pre) .. ".level") or 1
            local t = gamedataNewPerkType[tostring(perk)] or perk
            if d:IsNewPerkBought(t) < level then
              d:UnlockNewPerk(t)
              for _ = 1, level do d:BuyNewPerk(t, true) end
              done[#done + 1] = area
            end
          elseif okFact and fact then
            local name = fact.value or tostring(fact)
            if q:GetFactStr(name) < 1 then q:SetFactStr(name, 1) done[#done + 1] = area end
          end
        end
      end
    end
    local pd = Game.GetScriptableSystemsContainer():Get(CName.new("EquipmentSystem")):GetPlayerData(p)
    return (#done > 0 and "unlocked slots in " .. table.concat(done, ", ") or "every slot was already open")
      .. " (hands " .. pd:GetNumberOfSlots(gamedataEquipmentArea.HandsCW)
      .. ", skeleton " .. pd:GetNumberOfSlots(gamedataEquipmentArea.MusculoskeletalSystemCW)
      .. ", eyes " .. pd:GetNumberOfSlots(gamedataEquipmentArea.EyesCW) .. ")"
  end,
  -- every car and bike: "id=in-game name" separated by ";", for Capri's AI to pick from
  cars = function()
    local out = {}
    for _, c in ipairs(carList()) do out[#out + 1] = c.id:gsub("^Vehicle%.", "") .. "=" .. c.name end
    return table.concat(out, ";")
  end,
  -- unlock a car (Vehicle.v_..._player), make it the one you call, and call it over
  car = function(arg)
    local id = arg:find("%.") and arg or "Vehicle." .. arg
    if not TweakDB:GetRecord(id) then error("no such car: " .. arg) end
    player()
    local vs = Game.GetVehicleSystem()
    local kind = id:find("bike") and gamedataVehicleType.Bike or gamedataVehicleType.Car
    vs:EnablePlayerVehicle(id, true, false)
    vs:TogglePlayerActiveVehicle(GarageVehicleID.Resolve(id), kind, true)
    local name = id
    for _, c in ipairs(carList()) do if c.id == id and c.name ~= "" then name = c.name end end
    -- quests can block calling cars ("VehicleNoSummoning"): lifted, then called the normal way
    pcall(function() vs.restrictionTags = {} end)
    if vs:SpawnPlayerVehicle(kind, TweakDBID.new(id), false) then return name .. " is yours and on its way" end
    -- the game still said no (no road nearby, a scene...): it appears right in front of you
    local p = player()
    local pos, f = p:GetWorldPosition(), p:GetWorldForward()
    local wt = WorldTransform.new()
    wt:SetPosition(Vector4.new(pos.x + f.x * 6, pos.y + f.y * 6, pos.z + 0.5, 1))
    wt:SetOrientation(EulerAngles.new(0, 0, Vector4.ToRotation(f).yaw + 90):ToQuat())
    Game.GetPreventionSpawnSystem():RequestUnitSpawn(TweakDBID.new(id), wt)
    return name .. " is yours: it's in your garage now, and I dropped one right in front of you"
  end,
  -- places on the map, nearest first: "number=name (kind, metres)" separated by ";"
  places = function()
    local out = {}
    for i, pl in ipairs(placeList()) do
      if i > 90 then break end
      out[#out + 1] = i .. "=" .. (pl.name ~= "" and pl.name or "-") .. " (" .. pl.kind .. (pl.tracked and ", tracked" or "")
        .. ", " .. math.floor(pl.dist) .. "m)"
    end
    return table.concat(out, ";")
  end,
  -- the car you're in drives itself: "waypoint", a number from places, or "x,y,z"; ",speed" after it
  drive = function(arg)
    local where, speed = arg:match("^([^,]*),?(%d*)$")
    local car = player():GetMountedVehicle()
    if not car then error("get in a car first") end
    local pl = placeAt(where)
    local cmd = NewObject("AIVehicleDriveToPointAutonomousCommand")
    cmd.targetPosition = Vector3.new(pl.pos.x, pl.pos.y, pl.pos.z)
    cmd.maxSpeed = tonumber(speed) or 22
    cmd.minSpeed = 5
    cmd.clearTrafficOnPath = true
    cmd.minimumDistanceToTarget = 8
    cmd.driveDownTheRoadIndefinitely = false
    cmd.needDriver = false
    cmd.useKinematic = false
    local evt = AICommandEvent.new()
    evt.command = cmd
    car:QueueEvent(evt)
    driving = { car = car, cmd = cmd }
    return "driving to " .. (pl.name ~= "" and pl.name or where) .. " (" .. math.floor(pl.dist or 0) .. "m)"
  end,
  stop = function()
    local car = player():GetMountedVehicle()
    if not car then error("you're not in a car") end
    local cmd = NewObject("AIVehicleDriveToPointAutonomousCommand")
    local here = car:GetWorldPosition()
    cmd.targetPosition = Vector3.new(here.x, here.y, here.z)
    cmd.maxSpeed = 1
    cmd.minSpeed = 0
    cmd.minimumDistanceToTarget = 1000
    cmd.needDriver = false
    local evt = AICommandEvent.new()
    evt.command = cmd
    car:QueueEvent(evt)
    pcall(function() car:GetAIComponent():StopExecutingCommand(driving and driving.cmd, true) end)
    driving = nil
    return "stopped: you drive"
  end,
  -- jump there (with the car if you're in one): same places as drive
  warp = function(arg)
    local p = player()
    local pl = placeAt(arg)
    local who = p:GetMountedVehicle() or p
    Game.GetTeleportationFacility():Teleport(who, Vector4.new(pl.pos.x, pl.pos.y, pl.pos.z + 1, 1), EulerAngles.new(0, 0, 0))
    return "warped to " .. (pl.name ~= "" and pl.name or arg)
  end,
  -- "blackwall,look" / "burn,hostile,30" / "shock,all,15": a hack on the one you look at, hostiles, or everyone
  hack = function(arg)
    local what, which, radius = arg:match("^%s*([%w_]+)%s*,?%s*(%a*)%s*,?%s*(%d*)")
    local effects = HACKS[(what or ""):lower()]
    if not effects then error("hacks: blackwall, kill, suicide, collapse, burn, shock, blind, madness, stun, poison, overheat, ping") end
    local p = player()
    local list = people((which or "look"):lower(), tonumber(radius) or 25)
    if #list == 0 then error("nobody " .. (which == "all" and "around" or "hostile around")) end
    local ses = Game.GetStatusEffectSystem()
    for _, npc in ipairs(list) do
      for _, e in ipairs(effects) do
        ses:ApplyStatusEffect(npc:GetEntityID(), TweakDBID.new(e), p:GetRecordID(), p:GetEntityID())
      end
    end
    return what .. " on " .. #list .. (#list == 1 and " target" or " targets")
  end,
  -- "on" (3 m up) / "off" / "up,20" / "down,10" / "go,30" (glide where you look, m/s) / "stop" (hover)
  fly = function(arg)
    local what, n = tostring(arg or "on"):lower():match("^%s*(%a*)%s*,?%s*(%-?[%d.]*)")
    n = tonumber(n)
    if what == "off" or what == "land" then
      if not fly then return "not flying" end
      flyStop()
      return "flying off: you drop down safely"
    elseif what == "up" then flyStart(n or 10) return "up " .. (n or 10) .. " m"
    elseif what == "down" then flyStart(-(n or 10)) return "down " .. (n or 10) .. " m"
    elseif what == "go" then flyStart(0) fly.speed = math.max(2, math.min(n or 25, 120)) return "gliding where you look at " .. fly.speed .. " m/s"
    elseif what == "stop" then flyStart(0) fly.speed, fly.rise = 0, 0 return "hovering"
    end
    flyStart(n or 3)
    return "flying: you hover; walk to move, say up/down/go/stop/land"
  end,
  lua = function(arg) -- anything else CET can do, written by Capri and shown to you before it runs
    local fn, err = (loadstring or load)(arg)
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
  local okFly, errFly = pcall(flyTick, dt)
  if not okFly then fly = nil print("[CapriLink] fly stopped: " .. tostring(errFly)) end
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
