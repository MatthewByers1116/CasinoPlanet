#!/usr/bin/env python3
"""Reference task (success criterion 3): one real behavioural claim, end to end.

Claim: at difficulty='easy', hiring a 'dealer' increases sim.employees.size by
1 while hiring a 'chef' does not (chef is research-gated; dealer is not).

Every non-import, non-assertion line below is a toolkit call.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))))))

from tools.verify import cdp, game

scratch = sys.argv[1]
server = game.serve(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))))))
browser = cdp.launch(os.path.join(scratch, "udd_ref"))
try:
    session = browser.new_session(cdp.DESKTOP_VIEWPORT)
    game.boot(session, server, "index.html", "easy")
    dealer = game.act(session, "HIRE_EMPLOYEE", {"role": "dealer"}, settle=2.0)
    chef = game.act(session, "HIRE_EMPLOYEE", {"role": "chef"}, settle=2.0)

    assert dealer.changed is True, dealer
    assert dealer.after["employees"] - dealer.before["employees"] == 1, dealer
    assert chef.changed is False, chef
    assert chef.after["employees"] == chef.before["employees"], chef
    assert chef.preconditions["roleIsGated"] is True, chef.preconditions
    assert chef.preconditions["unlocked"] is False, chef.preconditions
    print("OK dealer +%d, chef +%d"
          % (dealer.after["employees"] - dealer.before["employees"],
             chef.after["employees"] - chef.before["employees"]))
finally:
    browser.close()
    server.close()
