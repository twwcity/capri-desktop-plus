package dev.capri.minecraft;

import com.mojang.brigadier.exceptions.CommandSyntaxException;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.block.BlockState;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityType;
import net.minecraft.nbt.NbtCompound;
import net.minecraft.nbt.NbtHelper;
import net.minecraft.nbt.StringNbtReader;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.BlockPos;

import java.util.ArrayList;
import java.util.List;

/**
 * The ores a scan found, pointed out: a block display of the same block over each one, glowing in
 * its ore's color, seen through walls, gone after a while (or at the next scan). Display entities:
 * no hitbox, no AI, nothing to push or hurt.
 */
public final class Markers {
	public record Mark(BlockPos pos, BlockState state, int color) {}

	private record Live(Entity entity, long until) {}

	private static final List<Live> LIVE = new ArrayList<>();
	private static boolean ticking;

	private Markers() {}

	public static void show(ServerWorld world, List<Mark> marks, int seconds) {
		clear();
		if (!ticking) {
			ticking = true;
			ServerTickEvents.END_SERVER_TICK.register(server -> {
				long now = server.getOverworld().getTime();
				LIVE.removeIf(l -> {
					if (l.until() > now && !l.entity().isRemoved()) return false;
					l.entity().discard();
					return true;
				});
			});
		}
		long until = world.getServer().getOverworld().getTime() + seconds * 20L;
		for (Mark m : marks) {
			Entity e = EntityType.BLOCK_DISPLAY.create(world);
			if (e == null) continue;
			try {
				// a hair bigger than the block, so its glow shows around it
				NbtCompound nbt = StringNbtReader.parse("{Glowing:1b,glow_color_override:" + m.color()
					+ ",brightness:{sky:15,block:15},transformation:{translation:[-0.01f,-0.01f,-0.01f],scale:[1.02f,1.02f,1.02f],left_rotation:[0f,0f,0f,1f],right_rotation:[0f,0f,0f,1f]}}");
				nbt.put("block_state", NbtHelper.fromBlockState(m.state()));
				e.readNbt(nbt);
			} catch (CommandSyntaxException ex) {
				CapriMod.LOG.warn("[Capri] marker: {}", ex.getMessage());
				continue;
			}
			e.refreshPositionAndAngles(m.pos().getX(), m.pos().getY(), m.pos().getZ(), 0, 0);
			e.addCommandTag("capri_marker");
			world.spawnEntity(e);
			LIVE.add(new Live(e, until));
		}
	}

	public static void clear() {
		for (Live l : LIVE) l.entity().discard();
		LIVE.clear();
	}
}
