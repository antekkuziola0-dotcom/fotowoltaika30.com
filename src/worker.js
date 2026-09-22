export default {
  async fetch(request, env, ctx) {
    // Nagłówki CORS — pozwalają stronie na GitHub Pages wywołać ten Worker
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Obsługa zapytania preflight (OPTIONS)
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // 1. Logowanie do Hoymiles
      const loginResponse = await fetch(
        "https://global.hoymiles.com/platform/api/gateway/iam/auth_login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: env.HOYMILES_EMAIL,
            password: env.HOYMILES_PASSWORD,
          }),
        }
      );
      const loginData = await loginResponse.json();
      const token = loginData.data?.token;

      if (!token) {
        return new Response(
          JSON.stringify({ error: "Błąd logowania do Hoymiles" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 2. Pobieranie danych o napięciach paneli
      const dataResponse = await fetch(
        "https://global.hoymiles.com/platform/api/gateway/pvm-data/data_find_details",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ plantId: "9389160" }),
        }
      );
      const data = await dataResponse.json();

      // 3. Wyodrębnienie napięć (dostosuj strukturę do rzeczywistej odpowiedzi API)
      const panels = data.data?.panels || [];
      const voltages = panels.map((p) => p.voltage);

      // 4. Logika sterowania
      const LOW_THRESHOLD = 49;
      const HIGH_THRESHOLD = 50;
      let newLimit = null;

      if (voltages.some((v) => v < LOW_THRESHOLD)) {
        newLimit = -2;
      } else if (voltages.some((v) => v > HIGH_THRESHOLD)) {
        newLimit = 0.1;
      }

      // 5. Ustawienie limitu (jeśli wymagane)
      if (newLimit !== null) {
        // TODO: Zastąp poniższy URL rzeczywistym endpointem do ustawiania limitu
        // await fetch("https://global.hoymiles.com/platform/api/gateway/pvm/station_set_reflux", {
        //   method: "POST",
        //   headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        //   body: JSON.stringify({ plantId: "9389160", reflux: newLimit }),
        // });
        console.log(`Ustawiono nowy limit: ${newLimit}`);
      }

      // 6. Zwrócenie danych do frontendu
      return new Response(
        JSON.stringify({
          voltages,
          limitSet: newLimit,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  },
};
