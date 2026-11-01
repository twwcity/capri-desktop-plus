package dev.capri.minecraft;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Locale;

/**
 * "capri <anything>": asked of Capri on your desktop (her local bridge, 127.0.0.1:47823/minecraft,
 * the port she listens on for Claude Code too; CAPRI_PORT overrides it). Her model answers as her,
 * knowing where you stand in the world; the answer comes back into the chat. Off the game thread:
 * the world never waits on her.
 */
public final class CapriBridge {
	private static final Gson GSON = new Gson();
	private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
	private static final int PORT = parsePort(System.getenv("CAPRI_PORT"));

	private CapriBridge() {}

	// --- Capri on the desktop, driving the mod: each second it asks her for what to do here --------

	private static java.util.concurrent.ScheduledExecutorService poller;

	static void start(MinecraftServer server) {
		stop();
		poller = java.util.concurrent.Executors.newSingleThreadScheduledExecutor(r -> {
			Thread t = new Thread(r, "capri-link");
			t.setDaemon(true);
			return t;
		});
		poller.scheduleWithFixedDelay(() -> poll(server), 2, 1, java.util.concurrent.TimeUnit.SECONDS);
	}

	static void stop() {
		if (poller != null) poller.shutdownNow();
		poller = null;
	}

	/** GET /minecraft/next: { commands: [{ id, cmd: scan | shock | say, arg }] }; each run, then its report sent back. */
	private static void poll(MinecraftServer server) {
		try {
			var players = server.getPlayerManager().getPlayerList();
			String who = players.isEmpty() ? "" : players.get(0).getName().getString();
			HttpRequest req = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + PORT + "/minecraft/next?player=" + java.net.URLEncoder.encode(who, java.nio.charset.StandardCharsets.UTF_8)))
				.timeout(Duration.ofSeconds(3)).GET().build();
			HttpResponse<String> res = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
			if (res.statusCode() != 200) return;
			JsonObject j = GSON.fromJson(res.body(), JsonObject.class);
			if (j == null || !j.has("commands")) return;
			for (var el : j.getAsJsonArray("commands")) {
				JsonObject c = el.getAsJsonObject();
				String id = c.has("id") ? c.get("id").getAsString() : "";
				String cmd = c.has("cmd") ? c.get("cmd").getAsString() : "";
				String arg = c.has("arg") && !c.get("arg").isJsonNull() ? c.get("arg").getAsString() : "";
				server.execute(() -> run(server, id, cmd, arg));
			}
		} catch (Exception ignored) {
			// Capri closed: nothing to do, she'll be asked again in a second
		}
	}

	private static void run(MinecraftServer server, String id, String cmd, String arg) {
		var players = server.getPlayerManager().getPlayerList();
		CapriMod.report = new StringBuilder();
		try {
			if (players.isEmpty()) CapriMod.report.append("No player in the world yet.");
			else if (cmd.equals("scan")) CapriMod.scan(players.get(0), arg);
			else if (cmd.equals("shock")) CapriMod.shock(players.get(0), arg);
			else if (cmd.equals("say")) CapriMod.say(server, arg);
		} finally {
			String report = CapriMod.report.toString().trim();
			CapriMod.report = null;
			JsonObject body = new JsonObject();
			body.addProperty("id", id);
			body.addProperty("report", report);
			HTTP.sendAsync(HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + PORT + "/minecraft/report"))
				.timeout(Duration.ofSeconds(5)).header("content-type", "application/json")
				.POST(HttpRequest.BodyPublishers.ofString(GSON.toJson(body))).build(), HttpResponse.BodyHandlers.discarding());
		}
	}

	private static int parsePort(String s) {
		try {
			return s == null ? 47823 : Integer.parseInt(s.trim());
		} catch (NumberFormatException e) {
			return 47823;
		}
	}

	public static void ask(ServerPlayerEntity player, String text) {
		MinecraftServer server = player.getServer();
		if (server == null) return;
		ServerWorld world = player.getServerWorld();
		JsonObject body = new JsonObject();
		body.addProperty("player", player.getName().getString());
		body.addProperty("text", text);
		// what she knows of where you are
		JsonObject at = new JsonObject();
		at.addProperty("dimension", world.getRegistryKey().getValue().toString());
		at.addProperty("x", player.getBlockX());
		at.addProperty("y", player.getBlockY());
		at.addProperty("z", player.getBlockZ());
		at.addProperty("health", Math.round(player.getHealth()));
		at.addProperty("maxHealth", Math.round(player.getMaxHealth()));
		at.addProperty("food", player.getHungerManager().getFoodLevel());
		at.addProperty("level", player.experienceLevel);
		at.addProperty("time", world.getTimeOfDay() % 24000);
		at.addProperty("raining", world.isRaining());
		at.addProperty("biome", world.getBiome(player.getBlockPos()).getKey().map(k -> k.getValue().getPath()).orElse("?"));
		at.addProperty("holding", player.getMainHandStack().isEmpty() ? "nothing" : player.getMainHandStack().getName().getString());
		at.addProperty("gamemode", player.interactionManager.getGameMode().getName().toLowerCase(Locale.ROOT));
		body.add("world", at);

		HttpRequest req = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + PORT + "/minecraft"))
			.timeout(Duration.ofSeconds(90))
			.header("content-type", "application/json")
			.POST(HttpRequest.BodyPublishers.ofString(GSON.toJson(body)))
			.build();
		HTTP.sendAsync(req, HttpResponse.BodyHandlers.ofString())
			.thenApply(res -> {
				JsonObject j = GSON.fromJson(res.body(), JsonObject.class);
				if (j != null && j.has("reply") && !j.get("reply").isJsonNull()) return j.get("reply").getAsString();
				String err = j != null && j.has("error") ? j.get("error").getAsString() : "HTTP " + res.statusCode();
				return "Signal's dirty, can't answer right now (" + err + ").";
			})
			.exceptionally(err -> "I'm not jacked in: open Capri on your desktop, then ask again.")
			.thenAccept(reply -> server.execute(() -> CapriMod.say(server, reply)));
	}
}
