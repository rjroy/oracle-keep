import Chat from "@/components/Chat";

export default function Home() {
  const cwd = process.env.ORACLE_CWD ?? process.cwd();
  return (
    <main>
      <Chat cwd={cwd} />
    </main>
  );
}
