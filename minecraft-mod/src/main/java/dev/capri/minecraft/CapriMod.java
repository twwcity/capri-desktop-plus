package dev.capri.minecraft;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.message.v1.ServerMessageEvents;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.LightningEntity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.mob.Monster;
import net.minecraft.particle.DustParticleEffect;
import net.minecraft.registry.tag.BlockTags;
import net.minecraft.registry.tag.TagKey;
import net.minecraft.block.Block;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.MutableText;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;
import org.joml.Vector3f;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Capri, jacked into your world. Everything typed in chat that starts with "capri " is hers:
 * "capri scan" finds the valuable ores within 15 blocks, "capri shock" / "capri kill" strikes every
 * hostile mob within 20 blocks with red Blackwall lightning (one hit, no fire, the drops kept), and
 * anything else is asked of Capri on your desktop, who answers here (CapriBridge).
 */
public class CapriMod implements ModInitializer {
	public static final String MOD_ID = "capri";
	public static final Logger LOG = LoggerFactory.getLogger(MOD_ID);

	/** The name a bolt carries so the client draws it red (LightningEntityRendererMixin). */
	public static final String BLACKWALL = "capri:blackwall";

	static final int SCAN_RADIUS = 15;
	static final int SCAN_SHOWN = 10;
	static final int SHOCK_RADIUS = 20;

	/** The ores she looks for, in order of worth: what they're called, and their color in chat. */
	private record Ore(String name, Formatting color, int glow, TagKey<Block> tag, Block block, String words) {
		boolean matches(BlockState state) {
			return tag != null ? state.isIn(tag) : state.isOf(block);
		}
	}

	private static final List<Ore> ORES = List.of(
		new Ore("Netherite (Ancient Debris)", Formatting.DARK_PURPLE, 0xB04CFF, null, Blocks.ANCIENT_DEBRIS, "netherite ancient debris เนเธอไรต์"),
		new Ore("Diamond", Formatting.AQUA, 0x3CF4FF, BlockTags.DIAMOND_ORES, null, "diamond เพชร"),
		new Ore("Emerald", Formatting.GREEN, 0x17FF6A, BlockTags.EMERALD_ORES, null, "emerald มรกต"),
		new Ore("Gold", Formatting.GOLD, 0xFFE03C, BlockTags.GOLD_ORES, null, "gold ทอง"),
		new Ore("Iron", Formatting.GRAY, 0xE8B894, BlockTags.IRON_ORES, null, "iron เหล็ก"),
		new Ore("Redstone", Formatting.RED, 0xFF2A2A, BlockTags.REDSTONE_ORES, null, "redstone เรดสโตน"),
		new Ore("Lapis Lazuli", Formatting.BLUE, 0x3D6BFF, BlockTags.LAPIS_ORES, null, "lapis ลาพิส"),
		new Ore("Copper", Formatting.GOLD, 0xFF8A3C, BlockTags.COPPER_ORES, null, "copper ทองแดง"),
		new Ore("Nether Quartz", Formatting.WHITE, 0xFFFFFF, null, Blocks.NETHER_QUARTZ_ORE, "quartz ควอตซ์"),
		new Ore("Coal", Formatting.DARK_GRAY, 0xB0B0B0, BlockTags.COAL_ORES, null, "coal ถ่าน")
	);
	static final int MARK_SECONDS = 30;
	static final int MARKED = 40; // at most this many glow at once

	private static final String[] SCAN_EMPTY = {
		"Scanned every block in 15m. Nothing but dirt and disappointment, choom.",
		"Zero hits. Even the stone's broke around here.",
		"Ping came back empty. Dig somewhere with more ambition."
	};
	private static final String[] SHOCK_EMPTY = {
		"No hostiles in 20m. You're scared of shadows, choom.",
		"Nothing to fry. Lucky them.",
		"Quickhack primed, zero targets. Boring."
	};
	private static final String[] SHOCK_DONE = {
		"Blackwall says hi. %d flatlined.",
		"%d targets, one ping. You're welcome.",
		"Fried %d gonks. Red's my color, don't you think?"
	};

	@Override
	public void onInitialize() {
		// her words come through the chat: the player's line stays in chat, she answers after it
		ServerMessageEvents.ALLOW_CHAT_MESSAGE.register((message, sender, params) -> {
			String raw = message.getContent().getString().trim();
			String lower = raw.toLowerCase(Locale.ROOT);
			if (lower.equals("capri") || lower.startsWith("capri ")) {
				String ask = raw.length() > 5 ? raw.substring(6).trim() : "";
				MinecraftServer server = sender.getServer();
				if (server != null) server.execute(() -> handle(sender, ask));
			}
			return true;
		});
		// Capri on the desktop drives the mod too: what she's asked there runs here (CapriBridge.poll)
		net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents.SERVER_STARTED.register(CapriBridge::start);
		net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents.SERVER_STOPPING.register(server -> CapriBridge.stop());
		LOG.info("[Capri] link up. Type \"capri help\" in chat.");
	}

	private static void handle(ServerPlayerEntity player, String ask) {
		String cmd = ask.toLowerCase(Locale.ROOT).trim();
		if (cmd.isEmpty() || cmd.equals("help")) {
			say(player.getServer(), "Jacked in. \"capri scan\" finds ores in 15m, \"capri shock\" fries every hostile in 20m, anything else and I'll answer. Try not to bore me.");
		} else if (cmd.equals("scan") || cmd.startsWith("scan ") || cmd.startsWith("สแกน") || cmd.startsWith("หาแร่")) {
			scan(player, cmd.replaceFirst("^(scan|สแกน|หาแร่)\\s*", ""));
		} else if (cmd.equals("shock") || cmd.equals("kill") || cmd.startsWith("shock ") || cmd.startsWith("kill ") || cmd.startsWith("ช็อต") || cmd.startsWith("ฆ่า")) {
			shock(player, cmd.replaceFirst("^(shock|kill|ช็อต|ฆ่า)\\s*", "").trim());
		} else {
			CapriBridge.ask(player, ask);
		}
	}

	// --- chat ---------------------------------------------------------------------------------

	/** "[Capri AI]" in bold red, then her words in cyan, to everyone in the world. */
	public static void say(MinecraftServer server, String words) {
		if (server == null) return;
		tell(server, line(Text.literal(words).styled(s -> s.withColor(Formatting.AQUA).withBold(false))), false);
	}

	/** What she says while a command from the desktop runs, to send back to Capri there (CapriBridge). */
	static StringBuilder report;

	/** A line in everyone's chat (and in the report, while one is being written). */
	static void tell(MinecraftServer server, Text text, boolean overlay) {
		server.getPlayerManager().broadcast(text, overlay);
		if (report != null) report.append(text.getString().replace("[Capri AI] ", "")).append('\n');
	}

	public static MutableText line(Text body) {
		return Text.literal("[Capri AI] ").styled(s -> s.withColor(Formatting.RED).withBold(true)).append(body);
	}

	private static String pick(String[] lines) {
		return lines[ThreadLocalRandom.current().nextInt(lines.length)];
	}

	// --- capri scan: the valuable ores within 15 blocks, the 10 closest with their X Y Z ---------

	private record Found(Ore ore, BlockPos pos, double distSq) {}

	static void scan(ServerPlayerEntity player, String only) {
		ServerWorld world = player.getServerWorld();
		// "capri scan diamond", "capri หาแร่ เพชร": that kind only
		List<Ore> wanted = only.isBlank() ? ORES : ORES.stream().filter(o -> java.util.Arrays.stream(only.split("\\s+")).anyMatch(w -> !w.isBlank() && o.words().contains(w))).toList();
		if (wanted.isEmpty()) wanted = ORES;
		BlockPos center = player.getBlockPos();
		int r = SCAN_RADIUS;
		List<Found> found = new ArrayList<>();
		Map<Ore, Integer> counts = new LinkedHashMap<>();
		for (BlockPos p : BlockPos.iterate(center.add(-r, -r, -r), center.add(r, r, r))) {
			double d = p.getSquaredDistance(center);
			if (d > r * r || !world.isInBuildLimit(p)) continue;
			BlockState state = world.getBlockState(p);
			if (state.isAir()) continue;
			for (Ore ore : wanted) {
				if (ore.matches(state)) {
					found.add(new Found(ore, p.toImmutable(), d));
					counts.merge(ore, 1, Integer::sum);
					break;
				}
			}
		}
		MinecraftServer server = player.getServer();
		// a scan pulse around her player, for the feel of it
		world.spawnParticles(new DustParticleEffect(new Vector3f(0.2f, 1.0f, 0.95f), 1.4f),
			player.getX(), player.getY() + 1, player.getZ(), 80, 3, 1.5, 3, 0.02);
		world.playSound(null, center, SoundEvents.BLOCK_BEACON_ACTIVATE, SoundCategory.PLAYERS, 0.6f, 1.8f);
		if (found.isEmpty()) {
			say(server, pick(SCAN_EMPTY));
			return;
		}
		found.sort(Comparator.comparingDouble(Found::distSq));
		Markers.show(world, found.stream().limit(MARKED).map(f -> new Markers.Mark(f.pos(), world.getBlockState(f.pos()), f.ore().glow())).toList(), MARK_SECONDS);
		MutableText summary = Text.literal("Scan done, " + found.size() + " ore blocks in 15m: ").styled(s -> s.withColor(Formatting.AQUA).withBold(false));
		boolean first = true;
		for (Map.Entry<Ore, Integer> e : counts.entrySet()) {
			if (!first) summary.append(Text.literal(", ").formatted(Formatting.AQUA));
			summary.append(Text.literal(e.getKey().name() + " x" + e.getValue()).styled(s -> s.withColor(e.getKey().color()).withBold(false)));
			first = false;
		}
		tell(server, line(summary), false);
		int shown = Math.min(SCAN_SHOWN, found.size());
		for (int i = 0; i < shown; i++) {
			Found f = found.get(i);
			BlockPos p = f.pos();
			MutableText row = Text.literal("  " + (i + 1) + ". ").formatted(Formatting.DARK_GRAY)
				.append(Text.literal(f.ore().name()).formatted(f.ore().color()))
				.append(Text.literal("  X " + p.getX() + "  Y " + p.getY() + "  Z " + p.getZ()).formatted(Formatting.WHITE))
				.append(Text.literal("  " + where(player, p)).formatted(Formatting.YELLOW));
			tell(server, row, false);
		}
		say(server, "They glow through walls for " + MARK_SECONDS + "s." + (found.size() > shown ? " Showing the " + shown + " closest in chat." : "") + " Go dig, I'm not your pickaxe.");
	}

	/** Where a block is from where the player looks: "4m ahead-left, 2 down". */
	static String where(ServerPlayerEntity player, BlockPos p) {
		double dx = p.getX() + 0.5 - player.getX();
		double dz = p.getZ() + 0.5 - player.getZ();
		int dy = p.getY() - player.getBlockY();
		double yaw = Math.toRadians(player.getYaw());
		double fx = -Math.sin(yaw), fz = Math.cos(yaw); // where they face
		double ahead = dx * fx + dz * fz;
		double right = dx * -fz + dz * fx;
		String side = Math.abs(ahead) >= Math.abs(right) * 2 ? (ahead >= 0 ? "ahead" : "behind")
			: Math.abs(right) >= Math.abs(ahead) * 2 ? (right >= 0 ? "right" : "left")
			: (ahead >= 0 ? "ahead-" : "behind-") + (right >= 0 ? "right" : "left");
		long flat = Math.round(Math.sqrt(dx * dx + dz * dz));
		String height = dy > 0 ? ", " + dy + " up" : dy < 0 ? ", " + (-dy) + " down" : "";
		return flat <= 0 ? (dy >= 0 ? dy + " up" : (-dy) + " down") : flat + "m " + side + height;
	}

	// --- capri shock / capri kill: red lightning on every hostile within 20 blocks, one hit ------

	/**
	 * Who's hit: "" every hostile mob; "all" (ทั้งหมด) every mob but your pets and the ones you named;
	 * else mobs whose kind is named ("capri shock zombie", "capri shock axolotl").
	 */
	static boolean target(LivingEntity e, String which) {
		if (e instanceof net.minecraft.entity.player.PlayerEntity || !(e instanceof net.minecraft.entity.mob.MobEntity)) return false;
		if (which.isEmpty()) return e instanceof Monster;
		if (e instanceof net.minecraft.entity.passive.TameableEntity t && t.isTamed()) return false;
		if (e.hasCustomName()) return false;
		if (which.equals("all") || which.equals("ทั้งหมด") || which.equals("everything")) return true;
		String kind = net.minecraft.registry.Registries.ENTITY_TYPE.getId(e.getType()).getPath().replace('_', ' ');
		String shown = e.getType().getName().getString().toLowerCase(Locale.ROOT);
		String w = which.toLowerCase(Locale.ROOT).replaceAll("s$", "");
		return kind.contains(w) || shown.contains(w) || w.contains(kind);
	}

	static void shock(ServerPlayerEntity player, String which) {
		ServerWorld world = player.getServerWorld();
		List<LivingEntity> targets = world.getEntitiesByClass(LivingEntity.class,
			player.getBoundingBox().expand(SHOCK_RADIUS),
			e -> e.isAlive() && e.squaredDistanceTo(player) <= SHOCK_RADIUS * SHOCK_RADIUS && target(e, which));
		MinecraftServer server = player.getServer();
		if (targets.isEmpty()) {
			say(server, which.isEmpty()
				? pick(SHOCK_EMPTY) + " (Only hostiles by default. \"capri shock all\" hits every mob, \"capri shock <mob>\" just that kind.)"
				: "No \"" + which + "\" in 20m to fry.");
			return;
		}
		DustParticleEffect red = new DustParticleEffect(new Vector3f(1.0f, 0.04f, 0.12f), 2.2f);
		DustParticleEffect glow = new DustParticleEffect(new Vector3f(1.0f, 0.45f, 0.5f), 1.2f);
		int killed = 0;
		for (LivingEntity target : targets) {
			Vec3d at = target.getPos();
			// the red bolt: a cosmetic lightning (no fire, no hit on blocks, items or the player),
			// drawn red by the client mixin
			LightningEntity bolt = EntityType.LIGHTNING_BOLT.create(world);
			if (bolt != null) {
				bolt.refreshPositionAfterTeleport(at.x, at.y, at.z);
				bolt.setCosmetic(true);
				bolt.setCustomName(Text.literal(BLACKWALL));
				bolt.setCustomNameVisible(false);
				world.spawnEntity(bolt);
			}
			// red dust pouring down from the sky onto it, and a burst where it lands
			for (double y = 24; y >= 0; y -= 0.6) {
				world.spawnParticles(red, at.x, at.y + y, at.z, 2, 0.08, 0.15, 0.08, 0);
			}
			world.spawnParticles(glow, at.x, at.y + 0.8, at.z, 40, 0.6, 0.8, 0.6, 0.05);
			// one hit: the player's own attack (their loot and XP), and if that isn't enough, gone
			target.damage(world.getDamageSources().playerAttack(player), Float.MAX_VALUE);
			if (target.isAlive()) target.kill();
			killed++;
		}
		world.playSound(null, player.getBlockPos(), SoundEvents.ENTITY_LIGHTNING_BOLT_THUNDER, SoundCategory.WEATHER, 1.5f, 0.7f);
		say(server, String.format(Locale.ROOT, pick(SHOCK_DONE), killed));
	}
}
